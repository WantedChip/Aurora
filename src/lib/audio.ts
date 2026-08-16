/**
 * Aurora Web Audio Engine & Real-Time Spectral Analyser
 * 
 * Provides:
 * 1. Procedural ambient harmonic drone synthesis (zero-permission default).
 * 2. Real-time microphone input stream capture via getUserMedia.
 * 3. Spectral analysis & frequency band extraction (Bass, Mid, Treble, Volume, Waveform).
 */

export type AudioSourceType = 'synth' | 'mic' | 'none';

export interface AudioFrequencyBands {
  bass: number;     // 0.0 - 1.0 (~20 Hz - 250 Hz)
  mid: number;      // 0.0 - 1.0 (~250 Hz - 2500 Hz)
  treble: number;   // 0.0 - 1.0 (~2500 Hz - 12000 Hz)
  volume: number;   // 0.0 - 1.0 (RMS overall amplitude)
}

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

  private currentSource: AudioSourceType = 'none';
  private isInitialized = false;
  private isRunning = false;

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
    this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
    this.masterGain.connect(this.analyser);

    // Synthesizer sub-gain (connects to master and destination for audio output)
    this.synthGain = this.ctx.createGain();
    this.synthGain.gain.setValueAtTime(0.6, this.ctx.currentTime);
    this.synthGain.connect(this.masterGain);
    this.synthGain.connect(this.ctx.destination);

    // Mic sub-gain (connects ONLY to master analyser to prevent microphone acoustic feedback loop)
    this.micGain = this.ctx.createGain();
    this.micGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
    this.micGain.connect(this.masterGain);

    this.isInitialized = true;
  }

  /**
   * Starts procedural ambient chord drone synthesis.
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
    }
  }

  /**
   * Stops live microphone stream.
   */
  public stopMic(): void {
    if (this.micSource) {
      try {
        this.micSource.disconnect();
      } catch {}
      this.micSource = null;
    }

    if (this.micStream) {
      this.micStream.getTracks().forEach(track => track.stop());
      this.micStream = null;
    }

    if (this.currentSource === 'mic') {
      this.currentSource = 'none';
      this.isRunning = false;
    }
  }

  /**
   * Stops all active sound generation and capture.
   */
  public stop(): void {
    this.stopSynth();
    this.stopMic();
  }

  /**
   * Sets master output gain [0.0, 1.0].
   */
  public setMasterGain(gain: number): void {
    if (this.masterGain && this.ctx) {
      const clamped = Math.max(0, Math.min(1, gain));
      this.masterGain.gain.setTargetAtTime(clamped, this.ctx.currentTime, 0.05);
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
   * Extracts isolated sub-bands: Bass, Mid, Treble, and overall RMS Volume.
   */
  public getFrequencyBands(): AudioFrequencyBands {
    const freqs = this.getFrequencyData();
    const len = freqs.length;

    if (len === 0) {
      return { bass: 0, mid: 0, treble: 0, volume: 0 };
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
    const bass = bassSum / (bassEnd * 255.0);

    let midSum = 0;
    const midEnd = Math.min(25, len);
    const midCount = midEnd - bassEnd;
    for (let i = bassEnd; i < midEnd; i++) {
      midSum += freqs[i];
    }
    const mid = midCount > 0 ? midSum / (midCount * 255.0) : 0;

    let trebleSum = 0;
    const trebleEnd = Math.min(120, len);
    const trebleCount = trebleEnd - midEnd;
    for (let i = midEnd; i < trebleEnd; i++) {
      trebleSum += freqs[i];
    }
    const treble = trebleCount > 0 ? trebleSum / (trebleCount * 255.0) : 0;

    // Overall RMS Volume
    let sumSquares = 0;
    for (let i = 0; i < len; i++) {
      const normalized = (freqs[i] / 255.0);
      sumSquares += normalized * normalized;
    }
    const volume = Math.sqrt(sumSquares / len);

    return { bass, mid, treble, volume };
  }

  public getBass(): number {
    return this.getFrequencyBands().bass;
  }

  public getMid(): number {
    return this.getFrequencyBands().mid;
  }

  public getTreble(): number {
    return this.getFrequencyBands().treble;
  }

  public getVolume(): number {
    return this.getFrequencyBands().volume;
  }

  public isAudioActive(): boolean {
    return this.isRunning;
  }

  public getAudioSourceType(): AudioSourceType {
    return this.currentSource;
  }

  /**
   * Closes and disposes AudioContext.
   */
  public dispose(): void {
    this.stop();
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close().catch(() => {});
    }
    this.ctx = null;
    this.isInitialized = false;
  }
}

// Global singleton instance for shared exhibit telemetry
export const audioManager = new AudioManager();
