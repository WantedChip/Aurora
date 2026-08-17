/**
 * Aurora Web Audio Engine & Real-Time Spectral Analyser
 * Direction: Obsidian Archival Minimal
 * 
 * Provides:
 * 1. Procedural ambient harmonic drone synthesis (zero-permission default).
 * 2. Real-time microphone input stream capture via getUserMedia with privacy guardrails.
 * 3. Spectral analysis & frequency band extraction (Bass, Mid, Treble, Volume, Waveform, Transient).
 * 4. Smoothed attack/decay envelope followers & beat transient detection.
 * 5. Downsampled logarithmic spectrum binning for high-performance visualizer HUDs.
 * 6. Clean lifecycle management (suspend, resume, mute, stop, dispose).
 */

export type AudioSourceType = 'synth' | 'mic' | 'none';

export interface AudioFrequencyBands {
  bass: number;       // Smoothed normalized [0.0, 1.0] (~20 Hz - 250 Hz)
  mid: number;        // Smoothed normalized [0.0, 1.0] (~250 Hz - 2500 Hz)
  treble: number;     // Smoothed normalized [0.0, 1.0] (~2500 Hz - 12000 Hz)
  volume: number;     // Smoothed RMS overall amplitude [0.0, 1.0]
  rawBass: number;    // Instantaneous raw normalized bass [0.0, 1.0]
  rawMid: number;     // Instantaneous raw normalized mid [0.0, 1.0]
  rawTreble: number;  // Instantaneous raw normalized treble [0.0, 1.0]
  rawVolume: number;  // Instantaneous raw RMS volume [0.0, 1.0]
  transient: number;  // Transient energy spike envelope [0.0, 1.0]
  isBeat: boolean;    // Transient beat detected in current frame
}

export type AudioStateListener = (source: AudioSourceType, isRunning: boolean, isMuted: boolean) => void;

export class AudioManager {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private masterGain: GainNode | null = null;
  private synthGain: GainNode | null = null;
  private micGain: GainNode | null = null;

  // Synthesizer nodes
  private oscillators: OscillatorNode[] = [];
  private lfos: OscillatorNode[] = [];
  private synthFilter: BiquadFilterNode | null = null;
  private noiseNode: AudioBufferSourceNode | null = null;

  // Microphone stream nodes
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;

  // Analysis buffers
  private freqData: Uint8Array<ArrayBuffer> | null = null;
  private timeData: Uint8Array<ArrayBuffer> | null = null;
  private normalizedFreqs: Float32Array<ArrayBuffer> | null = null;
  private normalizedTime: Float32Array<ArrayBuffer> | null = null;
  private spectrumBinsCache: Float32Array<ArrayBuffer> | null = null;

  // Envelope followers & smoothing
  private smoothedBass = 0.0;
  private smoothedMid = 0.0;
  private smoothedTreble = 0.0;
  private smoothedVolume = 0.0;
  private transientEnergy = 0.0;
  private energyBaseline = 0.1;
  private lastTransientTime = 0;
  private isCurrentBeat = false;

  // State
  private currentSource: AudioSourceType = 'none';
  private isInitialized = false;
  private isRunning = false;
  private isMutedState = false;
  private lastNonMutedGain = 0.7;
  private listeners: Set<AudioStateListener> = new Set();

  constructor() {
    // Lazy AudioContext initialization on first user interaction
  }

  /**
   * Initializes or resumes the AudioContext and analyser pipeline.
   */
  public async init(): Promise<void> {
    if (this.isInitialized && this.ctx) {
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }
      return;
    }

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      console.warn('Web Audio API is not supported in this browser.');
      return;
    }

    try {
      this.ctx = new AudioContextClass();
      
      // Analyser setup
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.82;

      const bufferLength = this.analyser.frequencyBinCount;
      this.freqData = new Uint8Array(bufferLength);
      this.timeData = new Uint8Array(bufferLength);
      this.normalizedFreqs = new Float32Array(bufferLength);
      this.normalizedTime = new Float32Array(bufferLength);

      // Master gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMutedState ? 0.0 : this.lastNonMutedGain, this.ctx.currentTime);
      this.masterGain.connect(this.analyser);

      // Synthesizer sub-gain (connects to master analyser and destination for audio output)
      this.synthGain = this.ctx.createGain();
      this.synthGain.gain.setValueAtTime(0.6, this.ctx.currentTime);
      this.synthGain.connect(this.masterGain);
      this.synthGain.connect(this.ctx.destination);

      // Mic sub-gain (connects ONLY to master analyser to prevent microphone acoustic feedback loop)
      this.micGain = this.ctx.createGain();
      this.micGain.gain.setValueAtTime(1.2, this.ctx.currentTime);
      this.micGain.connect(this.masterGain);

      this.isInitialized = true;
    } catch (err) {
      console.warn('Failed to initialize Web Audio Context:', err);
    }
  }

  /**
   * Starts procedural ambient chord drone synthesis (zero permissions needed).
   */
  public async startSynth(): Promise<void> {
    await this.init();
    if (!this.ctx || !this.synthGain) return;

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    // Stop existing oscillators if running
    this.stopSynth();
    this.stopMic();

    // Create celestial multi-oscillator ambient chord (A minor 9th / 432Hz harmonic palette)
    // Notes: A1 (55Hz), E2 (82.4Hz), A2 (110Hz), C3 (130.8Hz), G3 (196Hz), B3 (246.9Hz)
    const baseFreqs = [55.0, 82.41, 110.0, 130.81, 196.0, 246.94];
    const detunes = [-7, 5, -3, 6, -5, 4];
    const waveTypes: OscillatorType[] = ['sawtooth', 'sine', 'triangle', 'sine', 'triangle', 'sine'];

    // Lowpass filter with subtle resonance
    this.synthFilter = this.ctx.createBiquadFilter();
    this.synthFilter.type = 'lowpass';
    this.synthFilter.frequency.setValueAtTime(650, this.ctx.currentTime);
    this.synthFilter.Q.setValueAtTime(2.5, this.ctx.currentTime);
    this.synthFilter.connect(this.synthGain);

    // Filter LFO to create gentle cosmic breathing
    const filterLfo = this.ctx.createOscillator();
    const filterLfoGain = this.ctx.createGain();
    filterLfo.frequency.setValueAtTime(0.08, this.ctx.currentTime); // 12.5s cycle
    filterLfoGain.gain.setValueAtTime(250, this.ctx.currentTime);
    filterLfo.connect(filterLfoGain);
    filterLfoGain.connect(this.synthFilter.frequency);
    filterLfo.start();
    this.lfos.push(filterLfo);

    // Construct harmonic voice bank
    baseFreqs.forEach((freq, idx) => {
      if (!this.ctx || !this.synthFilter) return;

      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();

      osc.type = waveTypes[idx % waveTypes.length];
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      osc.detune.setValueAtTime(detunes[idx], this.ctx.currentTime);

      // Amplitude weighting (lower frequencies louder)
      const gainVal = 0.18 / (1 + idx * 0.35);
      oscGain.gain.setValueAtTime(gainVal, this.ctx.currentTime);

      // Pitch vibrato LFO
      const pitchLfo = this.ctx.createOscillator();
      const pitchLfoGain = this.ctx.createGain();
      pitchLfo.frequency.setValueAtTime(0.15 + idx * 0.05, this.ctx.currentTime);
      pitchLfoGain.gain.setValueAtTime(4.0 + idx, this.ctx.currentTime);
      pitchLfo.connect(pitchLfoGain);
      pitchLfoGain.connect(osc.detune);
      pitchLfo.start();
      this.lfos.push(pitchLfo);

      osc.connect(oscGain);
      oscGain.connect(this.synthFilter);
      osc.start();
      this.oscillators.push(osc);
    });

    // Create subtle pink noise floor for cosmic texture
    try {
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
        b6 = white * 0.115926;
      }

      this.noiseNode = this.ctx.createBufferSource();
      this.noiseNode.buffer = noiseBuffer;
      this.noiseNode.loop = true;
      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.04, this.ctx.currentTime);
      this.noiseNode.connect(noiseGain);
      noiseGain.connect(this.synthFilter);
      this.noiseNode.start();
    } catch {
      // Non-critical noise buffer creation fallback
    }

    this.currentSource = 'synth';
    this.isRunning = true;
    this.notifyStateChange();
  }

  /**
   * Connects live microphone input.
   * Returns true on success, false on permission denial/error.
   */
  public async connectMicrophone(): Promise<boolean> {
    await this.init();
    if (!this.ctx || !this.micGain) return false;

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('navigator.mediaDevices.getUserMedia is unsupported');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: true,
        },
        video: false,
      });

      this.stopSynth();
      this.stopMic();

      this.micStream = stream;
      this.micSource = this.ctx.createMediaStreamSource(stream);
      this.micSource.connect(this.micGain);

      this.currentSource = 'mic';
      this.isRunning = true;
      this.notifyStateChange();
      return true;
    } catch (err) {
      console.warn('Microphone stream access denied or failed:', err);
      // Fall back to ambient synthesizer
      await this.startSynth();
      return false;
    }
  }

  /**
   * Stops procedural synth oscillators and timers.
   */
  public stopSynth(): void {
    this.oscillators.forEach(osc => {
      try {
        osc.stop();
        osc.disconnect();
      } catch {}
    });
    this.oscillators = [];

    this.lfos.forEach(lfo => {
      try {
        lfo.stop();
        lfo.disconnect();
      } catch {}
    });
    this.lfos = [];

    if (this.noiseNode) {
      try {
        this.noiseNode.stop();
        this.noiseNode.disconnect();
      } catch {}
      this.noiseNode = null;
    }

    if (this.synthFilter) {
      try {
        this.synthFilter.disconnect();
      } catch {}
      this.synthFilter = null;
    }

    if (this.currentSource === 'synth') {
      this.currentSource = 'none';
      this.isRunning = false;
      this.notifyStateChange();
    }
  }

  /**
   * Stops live microphone stream and releases audio hardware tracks.
   */
  public stopMic(): void {
    if (this.micSource) {
      try {
        this.micSource.disconnect();
      } catch {}
      this.micSource = null;
    }

    if (this.micStream) {
      this.micStream.getTracks().forEach(track => {
        try {
          track.stop();
        } catch {}
      });
      this.micStream = null;
    }

    if (this.currentSource === 'mic') {
      this.currentSource = 'none';
      this.isRunning = false;
      this.notifyStateChange();
    }
  }

  /**
   * Stops all active sound generation and capture.
   */
  public stop(): void {
    this.stopSynth();
    this.stopMic();
    this.smoothedBass = 0;
    this.smoothedMid = 0;
    this.smoothedTreble = 0;
    this.smoothedVolume = 0;
    this.transientEnergy = 0;
  }

  /**
   * Cleanly suspends AudioContext.
   */
  public async suspend(): Promise<void> {
    if (this.ctx && this.ctx.state === 'running') {
      try {
        await this.ctx.suspend();
      } catch (err) {
        console.warn('Error suspending AudioContext:', err);
      }
    }
  }

  /**
   * Resumes suspended AudioContext.
   */
  public async resume(): Promise<void> {
    if (this.ctx && this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch (err) {
        console.warn('Error resuming AudioContext:', err);
      }
    }
  }

  /**
   * Sets master output gain [0.0, 1.0].
   */
  public setMasterGain(gain: number): void {
    const clamped = Math.max(0, Math.min(1, gain));
    if (clamped > 0) {
      this.lastNonMutedGain = clamped;
      if (this.isMutedState) {
        this.isMutedState = false;
      }
    }
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.isMutedState ? 0.0 : clamped, this.ctx.currentTime, 0.05);
    }
    this.notifyStateChange();
  }

  /**
   * Gets current master gain setting.
   */
  public getMasterGain(): number {
    return this.isMutedState ? 0.0 : this.lastNonMutedGain;
  }

  /**
   * Sets mute state.
   */
  public setMuted(muted: boolean): void {
    this.isMutedState = muted;
    if (this.masterGain && this.ctx) {
      const targetGain = muted ? 0.0 : this.lastNonMutedGain;
      this.masterGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.05);
    }
    this.notifyStateChange();
  }

  /**
   * Returns whether audio output is currently muted.
   */
  public isMuted(): boolean {
    return this.isMutedState;
  }

  /**
   * Toggles mute state and returns new state.
   */
  public toggleMute(): boolean {
    this.setMuted(!this.isMutedState);
    return this.isMutedState;
  }

  /**
   * Sets analyser FFT smoothing constant [0.0, 1.0].
   */
  public setSmoothing(smoothing: number): void {
    if (this.analyser) {
      this.analyser.smoothingTimeConstant = Math.max(0.0, Math.min(0.99, smoothing));
    }
  }

  /**
   * Returns current raw FFT frequency data.
   */
  public getFrequencyData(): Uint8Array<ArrayBuffer> {
    if (this.analyser && this.freqData) {
      this.analyser.getByteFrequencyData(this.freqData);
      return this.freqData;
    }
    return new Uint8Array(0);
  }

  /**
   * Returns current raw time-domain waveform data.
   */
  public getTimeDomainData(): Uint8Array<ArrayBuffer> {
    if (this.analyser && this.timeData) {
      this.analyser.getByteTimeDomainData(this.timeData);
      return this.timeData;
    }
    return new Uint8Array(0);
  }

  /**
   * Returns frequency data normalized in range [0.0, 1.0].
   */
  public getNormalizedFrequencies(): Float32Array<ArrayBuffer> {
    const raw = this.getFrequencyData();
    if (this.normalizedFreqs && raw.length === this.normalizedFreqs.length) {
      for (let i = 0; i < raw.length; i++) {
        this.normalizedFreqs[i] = raw[i] / 255.0;
      }
      return this.normalizedFreqs;
    }
    return new Float32Array(0);
  }

  /**
   * Returns time-domain waveform normalized in range [-1.0, 1.0].
   */
  public getWaveform(): Float32Array<ArrayBuffer> {
    const raw = this.getTimeDomainData();
    if (this.normalizedTime && raw.length === this.normalizedTime.length) {
      for (let i = 0; i < raw.length; i++) {
        this.normalizedTime[i] = (raw[i] - 128.0) / 128.0;
      }
      return this.normalizedTime;
    }
    return new Float32Array(0);
  }

  /**
   * Downsamples frequency spectrum into N logarithmic / perceptual visualizer bins in [0.0, 1.0].
   */
  public getSpectrumBins(binCount = 16): Float32Array<ArrayBuffer> {
    const raw = this.getFrequencyData();
    const len = raw.length;

    if (!this.spectrumBinsCache || this.spectrumBinsCache.length !== binCount) {
      this.spectrumBinsCache = new Float32Array(binCount);
    }

    if (len === 0) {
      this.spectrumBinsCache.fill(0);
      return this.spectrumBinsCache;
    }

    // Map bin indices exponentially from 0 to len
    for (let b = 0; b < binCount; b++) {
      const startFrac = Math.pow(b / binCount, 2.0);
      const endFrac = Math.pow((b + 1) / binCount, 2.0);
      const startIdx = Math.floor(startFrac * (len - 1));
      const endIdx = Math.max(startIdx + 1, Math.floor(endFrac * len));

      let sum = 0;
      let count = 0;
      for (let i = startIdx; i < endIdx && i < len; i++) {
        sum += raw[i];
        count++;
      }

      const avg = count > 0 ? sum / (count * 255.0) : 0;
      // Soft high-frequency boost for visual balance
      const boost = 1.0 + (b / binCount) * 0.8;
      this.spectrumBinsCache[b] = Math.min(1.0, avg * boost);
    }

    return this.spectrumBinsCache;
  }

  /**
   * Extracts isolated sub-bands: Bass, Mid, Treble, RMS Volume, and detects transients.
   * Returns smoothed attack/decay values [0.0, 1.0] and raw instantaneous values.
   */
  public getFrequencyBands(): AudioFrequencyBands {
    const freqs = this.getFrequencyData();
    const len = freqs.length;

    if (len === 0 || !this.isRunning) {
      // Decay smoothed values to zero
      this.smoothedBass *= 0.85;
      this.smoothedMid *= 0.85;
      this.smoothedTreble *= 0.85;
      this.smoothedVolume *= 0.85;
      this.transientEnergy *= 0.82;
      this.isCurrentBeat = false;

      return {
        bass: Math.max(0, this.smoothedBass),
        mid: Math.max(0, this.smoothedMid),
        treble: Math.max(0, this.smoothedTreble),
        volume: Math.max(0, this.smoothedVolume),
        rawBass: 0,
        rawMid: 0,
        rawTreble: 0,
        rawVolume: 0,
        transient: Math.max(0, this.transientEnergy),
        isBeat: false,
      };
    }

    // FFT size 512 gives 256 bins. At 44.1kHz sample rate, each bin ≈ 86.1 Hz.
    // Bass: bins 0..3 (~0 - 340 Hz)
    // Mid: bins 4..24 (~340 Hz - 2150 Hz)
    // Treble: bins 25..120 (~2150 Hz - 10300 Hz)

    let bassSum = 0;
    const bassEnd = Math.min(4, len);
    for (let i = 0; i < bassEnd; i++) {
      bassSum += freqs[i];
    }
    const rawBass = bassSum / (bassEnd * 255.0);

    let midSum = 0;
    const midEnd = Math.min(25, len);
    const midCount = midEnd - bassEnd;
    for (let i = bassEnd; i < midEnd; i++) {
      midSum += freqs[i];
    }
    const rawMid = midCount > 0 ? midSum / (midCount * 255.0) : 0;

    let trebleSum = 0;
    const trebleEnd = Math.min(120, len);
    const trebleCount = trebleEnd - midEnd;
    for (let i = midEnd; i < trebleEnd; i++) {
      trebleSum += freqs[i];
    }
    const rawTreble = trebleCount > 0 ? trebleSum / (trebleCount * 255.0) : 0;

    // Overall RMS Volume
    let sumSquares = 0;
    for (let i = 0; i < len; i++) {
      const normalized = freqs[i] / 255.0;
      sumSquares += normalized * normalized;
    }
    const rawVolume = Math.sqrt(sumSquares / len);

    // Apply fast-attack, smooth-decay envelope followers
    const attack = 0.45;
    const decay = 0.12;

    this.smoothedBass += (rawBass > this.smoothedBass ? attack : decay) * (rawBass - this.smoothedBass);
    this.smoothedMid += (rawMid > this.smoothedMid ? attack : decay) * (rawMid - this.smoothedMid);
    this.smoothedTreble += (rawTreble > this.smoothedTreble ? attack : decay) * (rawTreble - this.smoothedTreble);
    this.smoothedVolume += (rawVolume > this.smoothedVolume ? attack : decay) * (rawVolume - this.smoothedVolume);

    // Transient Detection (detect sudden energy bursts in bass & mid/treble flux)
    const instantEnergy = rawBass * 0.65 + rawMid * 0.2 + rawTreble * 0.15;
    this.energyBaseline += (instantEnergy - this.energyBaseline) * 0.05;

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const isSpike = instantEnergy > this.energyBaseline * 1.35 + 0.08;
    const timeSinceLast = now - this.lastTransientTime;

    if (isSpike && timeSinceLast > 120) {
      this.transientEnergy = 1.0;
      this.lastTransientTime = now;
      this.isCurrentBeat = true;
    } else {
      this.transientEnergy *= 0.85;
      this.isCurrentBeat = false;
    }

    return {
      bass: Math.max(0, Math.min(1, this.smoothedBass)),
      mid: Math.max(0, Math.min(1, this.smoothedMid)),
      treble: Math.max(0, Math.min(1, this.smoothedTreble)),
      volume: Math.max(0, Math.min(1, this.smoothedVolume)),
      rawBass,
      rawMid,
      rawTreble,
      rawVolume,
      transient: Math.max(0, Math.min(1, this.transientEnergy)),
      isBeat: this.isCurrentBeat,
    };
  }

  /**
   * Returns smoothed normalized bass [0.0, 1.0].
   */
  public getBass(): number {
    return this.getFrequencyBands().bass;
  }

  /**
   * Returns smoothed normalized mid [0.0, 1.0].
   */
  public getMid(): number {
    return this.getFrequencyBands().mid;
  }

  /**
   * Returns smoothed normalized treble [0.0, 1.0].
   */
  public getTreble(): number {
    return this.getFrequencyBands().treble;
  }

  /**
   * Returns smoothed normalized RMS volume [0.0, 1.0].
   */
  public getVolume(): number {
    return this.getFrequencyBands().volume;
  }

  /**
   * Returns current transient spike strength [0.0, 1.0].
   */
  public getTransient(): number {
    return this.getFrequencyBands().transient;
  }

  /**
   * Returns whether a transient beat was detected in the current frame.
   */
  public isTransientDetected(): boolean {
    return this.getFrequencyBands().isBeat;
  }

  /**
   * Returns whether audio capture/synthesis is actively running.
   */
  public isAudioActive(): boolean {
    return this.isRunning;
  }

  /**
   * Returns current active audio source type ('synth' | 'mic' | 'none').
   */
  public getAudioSourceType(): AudioSourceType {
    return this.currentSource;
  }

  /**
   * Returns underlying AudioContext.
   */
  public getAudioContext(): AudioContext | null {
    return this.ctx;
  }

  /**
   * Returns underlying AnalyserNode.
   */
  public getAnalyserNode(): AnalyserNode | null {
    return this.analyser;
  }

  /**
   * Registers a callback listener for audio state transitions.
   * Returns an unsubscribe function.
   */
  public onStateChange(listener: AudioStateListener): () => void {
    this.listeners.add(listener);
    // Initial call
    listener(this.currentSource, this.isRunning, this.isMutedState);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyStateChange(): void {
    this.listeners.forEach(fn => {
      try {
        fn(this.currentSource, this.isRunning, this.isMutedState);
      } catch (err) {
        console.warn('Error in audio state listener:', err);
      }
    });
  }

  /**
   * Closes and disposes AudioContext.
   */
  public dispose(): void {
    this.stop();
    this.listeners.clear();
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close().catch(() => {});
    }
    this.ctx = null;
    this.isInitialized = false;
  }
}

// Global singleton instance for shared exhibit telemetry
export const audioManager = new AudioManager();
