/**
 * Aurora Room Viewer & Fullscreen Viewport Controller
 * Direction: Obsidian Archival Minimal
 * 
 * Manages the full-screen canvas lifecycle, top navigation HUD bar,
 * Tweakpane parameter dock & mobile bottom drawer, discrete accessibility steppers,
 * deterministic seed randomization with smooth parameter damping,
 * parameter reset, URL state sharing, fullscreen toggling,
 * high-resolution snapshot & video loop export modals,
 * global audio reactivity pipeline & telemetry visualizer HUD widget,
 * microphone permission dialogue with privacy assurance,
 * 3000ms HUD auto-dimming on idle, keyboard shortcuts, and clean teardown.
 */

import { Pane } from 'tweakpane';
import type { RouteState } from './lib/router';
import { router } from './lib/router';
import { getRoomById, lazyLoadRoom } from './rooms/registry';
import type {
  RoomMetadata,
  RoomInstance,
  RoomCleanupFn,
  RoomPointerEvent,
  RoomContext,
  ControlDef,
} from './rooms/types';
import { createPRNG, generateRandomSeed, type PRNG } from './lib/prng';
import { detectGPUCapabilities, getClampedDPR, type GPUCapabilities } from './lib/gpu';
import { parseParams, syncStateToURL, copyShareableURL } from './lib/state';
import {
  captureSnapshot,
  recordVideoLoop,
  cancelVideoRecording,
  isRecordingActive,
  negotiateSupportedVideoCodec,
} from './lib/recorder';
import {
  audioManager,
  type AudioSourceType,
} from './lib/audio';

export class RoomViewer {
  private container: HTMLElement | null = null;
  private canvasContainer: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private loadingOverlay: HTMLElement | null = null;
  private gpuBanner: HTMLElement | null = null;
  private errorOverlay: HTMLElement | null = null;
  private hudBar: HTMLElement | null = null;
  private controlDock: HTMLElement | null = null;
  private mobileDrawer: HTMLElement | null = null;
  private mobileScrim: HTMLElement | null = null;
  private mobileToggleBtn: HTMLElement | null = null;
  private toastContainer: HTMLElement | null = null;
  private activeToastElement: HTMLElement | null = null;
  private toastTimer: number | null = null;

  // Export Modals
  private snapshotModal: HTMLElement | null = null;
  private videoModal: HTMLElement | null = null;
  private modalTriggerElement: HTMLElement | null = null;
  private activeSnapshotScale: 1 | 2 | 4 = 2;
  private activeSnapshotFormat: 'image/png' | 'image/jpeg' | 'image/webp' = 'image/png';
  private activeVideoDuration = 5;
  private activeVideoFPS = 60;
  private isSnapshotInProgress = false;
  private isRecordingInProgress = false;

  // Global Audio Reactivity Pipeline & Telemetry Widget
  private audioTelemetryWidget: HTMLElement | null = null;
  private audioCanvas: HTMLCanvasElement | null = null;
  private audioCanvasCtx: CanvasRenderingContext2D | null = null;
  private audioRafId = 0;
  private micPermissionModal: HTMLElement | null = null;
  private audioUnsubscribe: (() => void) | null = null;
  private peakHoldBins: Float32Array = new Float32Array(24);
  private peakDecayRate = 0.015;

  private pane: Pane | null = null;
  private activeRoomId: string | null = null;
  private activeMetadata: RoomMetadata | null = null;
  private activeParams: Record<string, any> = {};
  private currentRoomInstance: RoomInstance | null = null;
  private currentCleanup: RoomCleanupFn | null = null;
  private prng: PRNG | null = null;
  private dpr = 1.0;
  private gpuCapabilities: GPUCapabilities | null = null;

  private abortController: AbortController | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private resizeDebounceTimer: number | null = null;
  private urlDebounceTimer: number | null = null;
  private idleTimeoutTimer: number | null = null;
  private lerpAnimFrameId = 0;
  private lastRandomizeTimestamp = 0;

  private isPointerDown = false;
  private isMounted = false;
  private isDestroyed = false;
  private isPaused = false;
  private isHUDHidden = false;
  private isHUDDimmed = false;
  private isMobileDrawerOpen = false;
  private isInteractingWithControls = false;

  /**
   * Assembles and mounts the full-screen room viewport for the specified room ID and route state.
   */
  public async mount(app: HTMLElement, roomId: string, route: RouteState): Promise<void> {
    this.isDestroyed = false;
    this.activeRoomId = roomId;
    this.abortController = new AbortController();

    const metadata = getRoomById(roomId);
    if (!metadata) {
      console.warn(`Room "${roomId}" not found in catalog. Redirecting to gallery.`);
      router.navigateToGallery(true);
      return;
    }
    this.activeMetadata = metadata;

    // Merge default params with route params
    const rawRouteParams = route.params || {};
    this.activeParams = parseParams(rawRouteParams, metadata.defaultParams);
    if (!this.activeParams.seed) {
      this.activeParams.seed = metadata.defaultParams.seed || '#A8F29D';
    }

    this.prng = createPRNG(this.activeParams.seed);
    this.dpr = getClampedDPR(2.0);

    // Render viewport DOM scaffolding & top HUD
    this.renderDOM(app);
    this.showLoadingOverlay(metadata);

    // Initialize Tweakpane parameter controls
    this.setupControlDock();

    // Initialize Audio Telemetry Widget & State Sync
    this.setupAudioTelemetry();
    this.audioUnsubscribe = audioManager.onStateChange((source, isRunning, isMuted) => {
      this.updateAudioHUDState(source, isRunning, isMuted);
    });

    // Perform hardware capability check and mount room
    try {
      this.gpuCapabilities = await detectGPUCapabilities();
      if (this.isDestroyed) return;

      this.checkHardwareCapabilities(metadata, this.gpuCapabilities);
      this.setupResizeHandling();
      this.setupPointerListeners();
      this.setupKeyboardShortcuts();
      this.setupFullscreenListener();
      this.setupAutoDimming();
      this.setupMobileDrawer();

      // Dynamically load room simulation module
      const roomInstance = await lazyLoadRoom(roomId);
      if (this.isDestroyed) return;

      this.currentRoomInstance = roomInstance;

      // Initialize room canvas buffer dimensions
      this.resizeCanvasBuffer();

      // Mount room simulation instance
      const context: RoomContext = {
        canvas: this.canvas!,
        container: this.container!,
        params: { ...this.activeParams },
        prng: this.prng,
        dpr: this.dpr,
        audio: audioManager,
        onParamChange: (key: string, value: any) => {
          this.activeParams[key] = value;
          this.pane?.refresh();
        },
      };

      const cleanupResult = await roomInstance.mount(context);
      if (this.isDestroyed) {
        if (typeof cleanupResult === 'function') {
          cleanupResult();
        }
        return;
      }

      this.currentCleanup = typeof cleanupResult === 'function' ? cleanupResult : null;
      this.isMounted = true;

      // Hide loading screen smoothly
      this.hideLoadingOverlay();
    } catch (err) {
      if (this.isDestroyed) return;
      console.error(`Failed to mount room "${roomId}":`, err);
      this.showErrorOverlay(err instanceof Error ? err.message : String(err));
    }
  }

  /**
   * Tears down the active room viewport, disposes GPU resources, and removes event listeners.
   */
  public destroy(): void {
    this.isDestroyed = true;
    this.isMounted = false;

    if (isRecordingActive()) {
      cancelVideoRecording();
    }

    if (this.lerpAnimFrameId) {
      cancelAnimationFrame(this.lerpAnimFrameId);
      this.lerpAnimFrameId = 0;
    }

    if (this.audioRafId) {
      cancelAnimationFrame(this.audioRafId);
      this.audioRafId = 0;
    }

    if (this.audioUnsubscribe) {
      this.audioUnsubscribe();
      this.audioUnsubscribe = null;
    }

    // Suspend audio context and stop active generation cleanly
    audioManager.stop();
    audioManager.suspend();

    if (this.toastTimer !== null) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }

    if (this.resizeDebounceTimer !== null) {
      clearTimeout(this.resizeDebounceTimer);
      this.resizeDebounceTimer = null;
    }

    if (this.urlDebounceTimer !== null) {
      clearTimeout(this.urlDebounceTimer);
      this.urlDebounceTimer = null;
    }

    if (this.idleTimeoutTimer !== null) {
      clearTimeout(this.idleTimeoutTimer);
      this.idleTimeoutTimer = null;
    }

    if (this.pane) {
      try {
        this.pane.dispose();
      } catch (paneErr) {
        console.warn('Error during Tweakpane disposal:', paneErr);
      }
      this.pane = null;
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    if (this.currentCleanup) {
      try {
        this.currentCleanup();
      } catch (cleanupErr) {
        console.warn('Error during room cleanup function execution:', cleanupErr);
      }
      this.currentCleanup = null;
    }

    this.currentRoomInstance = null;
    this.prng = null;

    if (this.gpuBanner && this.gpuBanner.parentNode) {
      this.gpuBanner.parentNode.removeChild(this.gpuBanner);
      this.gpuBanner = null;
    }

    if (this.errorOverlay && this.errorOverlay.parentNode) {
      this.errorOverlay.parentNode.removeChild(this.errorOverlay);
      this.errorOverlay = null;
    }

    if (this.loadingOverlay && this.loadingOverlay.parentNode) {
      this.loadingOverlay.parentNode.removeChild(this.loadingOverlay);
      this.loadingOverlay = null;
    }

    if (this.snapshotModal && this.snapshotModal.parentNode) {
      this.snapshotModal.parentNode.removeChild(this.snapshotModal);
      this.snapshotModal = null;
    }

    if (this.videoModal && this.videoModal.parentNode) {
      this.videoModal.parentNode.removeChild(this.videoModal);
      this.videoModal = null;
    }

    if (this.micPermissionModal && this.micPermissionModal.parentNode) {
      this.micPermissionModal.parentNode.removeChild(this.micPermissionModal);
      this.micPermissionModal = null;
    }

    if (this.audioTelemetryWidget && this.audioTelemetryWidget.parentNode) {
      this.audioTelemetryWidget.parentNode.removeChild(this.audioTelemetryWidget);
      this.audioTelemetryWidget = null;
    }
    this.audioCanvas = null;
    this.audioCanvasCtx = null;

    if (this.toastContainer && this.toastContainer.parentNode) {
      this.toastContainer.parentNode.removeChild(this.toastContainer);
      this.toastContainer = null;
    }

    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.canvas = null;
    this.canvasContainer = null;
    this.hudBar = null;
    this.controlDock = null;
    this.mobileDrawer = null;
    this.mobileScrim = null;
    this.mobileToggleBtn = null;
  }

  /**
   * Returns whether the room simulation is currently active and mounted.
   */
  public isSimulationMounted(): boolean {
    return this.isMounted && !this.isDestroyed;
  }

  /**
   * Returns the main canvas element.
   */
  public getCanvas(): HTMLCanvasElement | null {
    return this.canvas;
  }

  /**
   * Returns the active room metadata.
   */
  public getMetadata(): RoomMetadata | null {
    return this.activeMetadata;
  }

  /**
   * Returns current active parameters.
   */
  public getParams(): Record<string, any> {
    return { ...this.activeParams };
  }

  /**
   * Returns the top HUD bar element.
   */
  public getHudBar(): HTMLElement | null {
    return this.hudBar;
  }

  /**
   * Returns the Tweakpane control dock element.
   */
  public getControlDock(): HTMLElement | null {
    return this.controlDock;
  }

  /**
   * Returns the active Tweakpane instance.
   */
  public getPane(): Pane | null {
    return this.pane;
  }

  /**
   * Returns the detected GPU capabilities.
   */
  public getGPUCapabilities(): GPUCapabilities | null {
    return this.gpuCapabilities;
  }

  /**
   * Returns the Audio Telemetry HUD widget container.
   */
  public getAudioTelemetryWidget(): HTMLElement | null {
    return this.audioTelemetryWidget;
  }

  /**
   * Returns the Microphone Permission Modal element.
   */
  public getMicPermissionModal(): HTMLElement | null {
    return this.micPermissionModal;
  }

  /**
   * Updates room parameters dynamically and forwards them to the active simulation instance.
   */
  public updateParams(newParams: Record<string, any>): void {
    this.activeParams = { ...this.activeParams, ...newParams };
    this.pane?.refresh();
    if (this.currentRoomInstance && typeof this.currentRoomInstance.updateParams === 'function') {
      this.currentRoomInstance.updateParams(this.activeParams);
    }
  }

  /**
   * Randomizes the deterministic seed and generates smooth parameter offsets.
   */
  public async randomizeSeed(): Promise<void> {
    const now = performance.now();
    if (now - this.lastRandomizeTimestamp < 150 || !this.activeMetadata || this.isDestroyed) {
      return;
    }
    this.lastRandomizeTimestamp = now;
    this.wakeHUD();

    const newSeed = generateRandomSeed();
    const seedPrng = createPRNG(newSeed);
    const targetParams: Record<string, any> = { ...this.activeParams, seed: newSeed };

    // Compute randomized values for each registered control
    for (const ctrl of this.activeMetadata.controls) {
      if (ctrl.type === 'slider' && ctrl.min !== undefined && ctrl.max !== undefined) {
        const rawVal = seedPrng.nextFloat(ctrl.min, ctrl.max);
        if (ctrl.step) {
          targetParams[ctrl.key] = Math.round(rawVal / ctrl.step) * ctrl.step;
        } else {
          targetParams[ctrl.key] = parseFloat(rawVal.toFixed(3));
        }
      } else if (ctrl.type === 'select' && ctrl.options && ctrl.options.length > 0) {
        targetParams[ctrl.key] = seedPrng.choice(ctrl.options).value;
      } else if (ctrl.type === 'boolean') {
        targetParams[ctrl.key] = seedPrng.nextBool();
      }
    }

    // Trigger spring pulse animation on seed button
    const seedBtn = this.hudBar?.querySelector<HTMLButtonElement>('#room-hud-btn-seed');
    if (seedBtn) {
      seedBtn.classList.remove('pulse-spring');
      // Trigger reflow to restart CSS animation
      void seedBtn.offsetWidth;
      seedBtn.classList.add('pulse-spring');
      const seedLabel = seedBtn.querySelector('.seed-value');
      if (seedLabel) {
        seedLabel.textContent = newSeed;
      }
    }

    // Sync URL hash without polluting history
    syncStateToURL(this.activeRoomId, targetParams, this.activeMetadata.defaultParams, true);

    this.showToast(`Seed ${newSeed} Generated`);

    // Smoothly interpolate parameters over 400ms
    await this.interpolateParams(targetParams, 400);
  }

  /**
   * Resets all parameters back to initial exhibit default parameters cleanly.
   */
  public async resetDefaults(): Promise<void> {
    if (!this.activeMetadata || this.isDestroyed) return;
    this.wakeHUD();

    const defaultParams = { ...this.activeMetadata.defaultParams };
    
    const seedBtn = this.hudBar?.querySelector<HTMLButtonElement>('#room-hud-btn-seed');
    if (seedBtn) {
      const seedLabel = seedBtn.querySelector('.seed-value');
      if (seedLabel) {
        seedLabel.textContent = defaultParams.seed || '#A8F29D';
      }
    }

    // Sync URL hash
    syncStateToURL(this.activeRoomId, defaultParams, this.activeMetadata.defaultParams, true);

    this.showToast('Default Parameters Restored');

    // Smoothly interpolate parameters back to defaults
    await this.interpolateParams(defaultParams, 350);
  }

  /**
   * Copies the current deep link URL with serialized parameters to the clipboard.
   */
  public async shareURL(): Promise<void> {
    if (!this.activeRoomId || !this.activeMetadata) return;
    this.wakeHUD();

    try {
      await copyShareableURL(this.activeRoomId, this.activeParams, this.activeMetadata.defaultParams);
      this.showToast('Shareable Link Copied to Clipboard');
    } catch {
      this.showToast('Could not access clipboard');
    }
  }

  /**
   * Toggles standard browser fullscreen mode.
   */
  public toggleFullscreen(): void {
    if (typeof document === 'undefined') return;
    this.wakeHUD();

    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(err => {
        console.warn('Fullscreen request failed:', err);
      });
    } else {
      document.exitFullscreen?.().catch(err => {
        console.warn('Exit fullscreen failed:', err);
      });
    }
  }

  /**
   * Toggles between paused and active simulation states.
   */
  public togglePause(): void {
    this.isPaused = !this.isPaused;
    this.wakeHUD();

    if (this.currentRoomInstance) {
      if (typeof (this.currentRoomInstance as any).setPaused === 'function') {
        (this.currentRoomInstance as any).setPaused(this.isPaused);
      }
    }

    this.showToast(this.isPaused ? 'Simulation Paused' : 'Simulation Resumed');
  }

  /**
   * Toggles manual HUD visibility for pristine un-occluded exhibit viewing.
   */
  public toggleHUDVisibility(): void {
    this.isHUDHidden = !this.isHUDHidden;
    if (this.container) {
      this.container.classList.toggle('hud-hidden', this.isHUDHidden);
    }
    if (this.isHUDHidden) {
      this.showToast("HUD Hidden (Press 'H' to show)");
    } else {
      this.showToast('HUD Restored');
    }
  }

  /**
   * Cycles audio source (Synth -> Mic -> Muted -> Synth).
   */
  public async toggleAudioSource(): Promise<void> {
    const current = audioManager.getAudioSourceType();
    const isMuted = audioManager.isMuted();

    if (isMuted) {
      audioManager.setMuted(false);
      this.showToast('Audio Unmuted');
      this.wakeHUD();
      return;
    }

    if (current === 'synth') {
      this.openMicPermissionModal();
    } else if (current === 'mic') {
      audioManager.setMuted(true);
      this.showToast('Audio Muted');
    } else {
      await audioManager.startSynth();
      this.showToast('Ambient Synth Active');
    }
    this.wakeHUD();
  }

  /**
   * Toggles audio mute state.
   */
  public toggleAudioMute(): boolean {
    const isMuted = audioManager.toggleMute();
    this.showToast(isMuted ? 'Audio Muted' : 'Audio Active');
    this.wakeHUD();
    return isMuted;
  }

  /**
   * Opens the High-Resolution Snapshot Export modal dialogue.
   */
  public openSnapshotModal(triggerEl?: HTMLElement | null): void {
    if (this.videoModal && !this.videoModal.classList.contains('hidden')) {
      this.closeVideoModal();
    }
    if (this.micPermissionModal && !this.micPermissionModal.classList.contains('hidden')) {
      this.closeMicPermissionModal();
    }

    this.modalTriggerElement = triggerEl || (document.activeElement as HTMLElement | null);

    if (!this.snapshotModal) {
      this.renderSnapshotModal();
    }

    this.snapshotModal?.classList.remove('hidden');
    this.snapshotModal?.classList.remove('closing');
    this.snapshotModal?.setAttribute('aria-hidden', 'false');
    this.updateSnapshotInfoStrip();
    this.wakeHUD();

    const closeBtn = this.snapshotModal?.querySelector<HTMLButtonElement>('#snap-modal-btn-close');
    closeBtn?.focus();
  }

  /**
   * Closes the Snapshot modal dialogue.
   */
  public closeSnapshotModal(): void {
    if (!this.snapshotModal || this.snapshotModal.classList.contains('hidden')) return;

    this.snapshotModal.classList.add('closing');
    this.snapshotModal.setAttribute('aria-hidden', 'true');
    setTimeout(() => {
      this.snapshotModal?.classList.add('hidden');
      this.snapshotModal?.classList.remove('closing');
    }, 180);

    if (this.modalTriggerElement && typeof this.modalTriggerElement.focus === 'function') {
      this.modalTriggerElement.focus();
      this.modalTriggerElement = null;
    }
  }

  /**
   * Opens the Video Loop Export modal dialogue.
   */
  public openVideoModal(triggerEl?: HTMLElement | null): void {
    if (this.snapshotModal && !this.snapshotModal.classList.contains('hidden')) {
      this.closeSnapshotModal();
    }
    if (this.micPermissionModal && !this.micPermissionModal.classList.contains('hidden')) {
      this.closeMicPermissionModal();
    }

    this.modalTriggerElement = triggerEl || (document.activeElement as HTMLElement | null);

    if (!this.videoModal) {
      this.renderVideoModal();
    }

    this.videoModal?.classList.remove('hidden');
    this.videoModal?.classList.remove('closing');
    this.videoModal?.setAttribute('aria-hidden', 'false');
    this.wakeHUD();

    const closeBtn = this.videoModal?.querySelector<HTMLButtonElement>('#video-modal-btn-close');
    closeBtn?.focus();
  }

  /**
   * Closes the Video Loop modal dialogue and cancels active recordings if any.
   */
  public closeVideoModal(): void {
    if (!this.videoModal || this.videoModal.classList.contains('hidden')) return;

    if (this.isRecordingInProgress) {
      cancelVideoRecording();
      this.isRecordingInProgress = false;
    }

    this.videoModal.classList.add('closing');
    this.videoModal.setAttribute('aria-hidden', 'true');
    setTimeout(() => {
      this.videoModal?.classList.add('hidden');
      this.videoModal?.classList.remove('closing');
    }, 180);

    if (this.modalTriggerElement && typeof this.modalTriggerElement.focus === 'function') {
      this.modalTriggerElement.focus();
      this.modalTriggerElement = null;
    }
  }

  /**
   * Opens the Microphone Permission Dialogue Modal with privacy explainer.
   */
  public openMicPermissionModal(triggerEl?: HTMLElement | null): void {
    if (this.snapshotModal && !this.snapshotModal.classList.contains('hidden')) {
      this.closeSnapshotModal();
    }
    if (this.videoModal && !this.videoModal.classList.contains('hidden')) {
      this.closeVideoModal();
    }

    this.modalTriggerElement = triggerEl || (document.activeElement as HTMLElement | null);

    if (!this.micPermissionModal) {
      this.renderMicPermissionModal();
    }

    this.micPermissionModal?.classList.remove('hidden');
    this.micPermissionModal?.classList.remove('closing');
    this.micPermissionModal?.setAttribute('aria-hidden', 'false');
    this.wakeHUD();

    const allowBtn = this.micPermissionModal?.querySelector<HTMLButtonElement>('#mic-modal-btn-allow');
    allowBtn?.focus();
  }

  /**
   * Closes the Microphone Permission Modal.
   */
  public closeMicPermissionModal(): void {
    if (!this.micPermissionModal || this.micPermissionModal.classList.contains('hidden')) return;

    this.micPermissionModal.classList.add('closing');
    this.micPermissionModal.setAttribute('aria-hidden', 'true');
    setTimeout(() => {
      this.micPermissionModal?.classList.add('hidden');
      this.micPermissionModal?.classList.remove('closing');
    }, 180);

    if (this.modalTriggerElement && typeof this.modalTriggerElement.focus === 'function') {
      this.modalTriggerElement.focus();
      this.modalTriggerElement = null;
    }
  }

  /**
   * Displays an Obsidian Archival Minimal starlight toast notification at the bottom of the viewport.
   */
  public showToast(message: string, durationMs = 2000): void {
    if (!this.container || this.isDestroyed) return;

    if (!this.toastContainer) {
      const toastContainer = document.createElement('div');
      toastContainer.className = 'room-toast-container';
      toastContainer.id = 'room-toast-container';
      toastContainer.setAttribute('role', 'status');
      toastContainer.setAttribute('aria-live', 'polite');
      this.container.appendChild(toastContainer);
      this.toastContainer = toastContainer;
    }

    if (this.toastTimer !== null) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }

    if (this.activeToastElement) {
      this.activeToastElement.remove();
      this.activeToastElement = null;
    }

    const toast = document.createElement('div');
    toast.className = 'room-toast';
    toast.innerHTML = `
      <span class="room-toast-icon" aria-hidden="true">✦</span>
      <span class="room-toast-text">${message}</span>
    `;

    this.toastContainer.appendChild(toast);
    this.activeToastElement = toast;

    this.toastTimer = window.setTimeout(() => {
      if (this.activeToastElement === toast) {
        toast.classList.add('hiding');
        setTimeout(() => {
          if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
          }
          if (this.activeToastElement === toast) {
            this.activeToastElement = null;
          }
        }, 220);
      }
    }, durationMs);
  }

  /**
   * Interpolates numerical parameters smoothly towards target parameters using exponential easing.
   */
  private interpolateParams(targetParams: Record<string, any>, durationMs: number): Promise<void> {
    if (this.lerpAnimFrameId) {
      cancelAnimationFrame(this.lerpAnimFrameId);
      this.lerpAnimFrameId = 0;
    }

    return new Promise(resolve => {
      const startParams = { ...this.activeParams };
      const startTime = performance.now();

      // Immediately apply non-numeric parameters
      for (const [key, targetVal] of Object.entries(targetParams)) {
        if (typeof targetVal !== 'number') {
          this.activeParams[key] = targetVal;
        }
      }

      const step = (now: number) => {
        if (this.isDestroyed) {
          resolve();
          return;
        }

        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / durationMs);

        // Exponential ease out: 1 - Math.pow(2, -10 * progress)
        const easeOut = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);

        for (const [key, targetVal] of Object.entries(targetParams)) {
          if (typeof targetVal === 'number') {
            const startVal = typeof startParams[key] === 'number' ? startParams[key] : targetVal;
            const currentVal = startVal + (targetVal - startVal) * easeOut;
            this.activeParams[key] = currentVal;
          }
        }

        this.pane?.refresh();

        if (this.currentRoomInstance && typeof this.currentRoomInstance.updateParams === 'function') {
          this.currentRoomInstance.updateParams(this.activeParams);
        }

        if (progress < 1) {
          this.lerpAnimFrameId = requestAnimationFrame(step);
        } else {
          // Final exact parameter snapshot
          this.activeParams = { ...this.activeParams, ...targetParams };
          this.pane?.refresh();
          if (this.currentRoomInstance && typeof this.currentRoomInstance.updateParams === 'function') {
            this.currentRoomInstance.updateParams(this.activeParams);
          }
          this.lerpAnimFrameId = 0;
          resolve();
        }
      };

      this.lerpAnimFrameId = requestAnimationFrame(step);
    });
  }

  /**
   * Renders the foundational DOM structure for the room viewer, HUD, control dock, and mobile drawer.
   */
  private renderDOM(app: HTMLElement): void {
    const meta = this.activeMetadata!;

    const container = document.createElement('div');
    container.className = 'room-viewport-container';
    container.id = 'room-viewport';

    // Canvas container host
    const canvasContainer = document.createElement('div');
    canvasContainer.className = 'room-canvas-container';

    const canvas = document.createElement('canvas');
    canvas.className = 'room-canvas';
    canvas.setAttribute('aria-label', `${meta.name} Generative Simulation Canvas`);
    canvasContainer.appendChild(canvas);
    container.appendChild(canvasContainer);

    // In-Room Top Navigation HUD Bar
    const hudBar = document.createElement('header');
    hudBar.className = 'room-hud-bar';
    hudBar.id = 'room-hud-bar';
    hudBar.setAttribute('role', 'toolbar');
    hudBar.setAttribute('aria-label', 'Exhibit Navigation & Controls');

    hudBar.innerHTML = `
      <div class="room-hud-left">
        <button type="button" id="room-hud-btn-back" class="room-hud-back" aria-label="Return to Gallery" title="Return to Gallery (Esc)">
          <span aria-hidden="true">←</span> Gallery
        </button>
        <div class="room-hud-divider" aria-hidden="true"></div>
        <div class="room-hud-identity">
          <span class="room-hud-index">${meta.indexDisplay}</span>
          <h1 class="room-hud-title">${meta.name}</h1>
          <span class="room-hud-category-pill">${meta.categoryName}</span>
        </div>
      </div>

      <div class="room-hud-right">
        <div class="room-hud-actions">
          <button type="button" id="room-hud-btn-audio" class="room-hud-action-btn state-synth" aria-label="Toggle Audio Reactivity & Source" title="Audio Reactivity (A)">
            <span aria-hidden="true" class="icon" id="room-hud-audio-icon">🎵</span> <span id="room-hud-audio-label">Synth</span>
          </button>

          <button type="button" id="room-hud-btn-seed" class="room-hud-seed-btn" aria-label="Randomize Seed & Parameters" title="Randomize Seed (R)">
            <span aria-hidden="true">🎲</span> <span class="seed-value">${this.activeParams.seed}</span>
          </button>

          <button type="button" id="room-hud-btn-reset" class="room-hud-action-btn" aria-label="Reset Parameters to Default" title="Reset Defaults">
            <span aria-hidden="true" class="icon">↺</span> <span>Reset</span>
          </button>

          <button type="button" id="room-hud-btn-snapshot" class="room-hud-action-btn" aria-label="Export High-Resolution Snapshot" title="Export Snapshot (S)">
            <span aria-hidden="true" class="icon">📸</span> <span>Snapshot</span>
          </button>

          <button type="button" id="room-hud-btn-record" class="room-hud-action-btn" aria-label="Record Video Loop" title="Record Video Loop (L)">
            <span aria-hidden="true" class="icon">🎥</span> <span>Loop</span>
          </button>

          <button type="button" id="room-hud-btn-share" class="room-hud-action-btn" aria-label="Share Parameter Link" title="Copy Shareable Link (C)">
            <span aria-hidden="true" class="icon">🔗</span> <span>Share</span>
          </button>

          <button type="button" id="room-hud-btn-fullscreen" class="room-hud-icon-btn" aria-label="Toggle Fullscreen Mode" title="Toggle Fullscreen (F)">
            <span aria-hidden="true" class="fs-icon">⛶</span>
          </button>
        </div>

        <span class="room-hud-badge" title="Rendering Backend">${meta.backendDisplay}</span>
      </div>
    `;

    container.appendChild(hudBar);

    // Desktop Floating Control Dock
    const controlDock = document.createElement('aside');
    controlDock.className = 'room-control-dock';
    controlDock.id = 'room-control-dock';
    controlDock.setAttribute('aria-label', 'Exhibit Parameter Controls');
    container.appendChild(controlDock);

    // Mobile Control Toggle Button
    const mobileToggleBtn = document.createElement('button');
    mobileToggleBtn.type = 'button';
    mobileToggleBtn.className = 'room-mobile-toggle-btn';
    mobileToggleBtn.id = 'room-mobile-toggle-btn';
    mobileToggleBtn.setAttribute('aria-label', 'Open Parameter Controls');
    mobileToggleBtn.innerHTML = `
      <span aria-hidden="true">🎛</span>
      <span>Parameters</span>
    `;
    container.appendChild(mobileToggleBtn);

    // Mobile Scrim & Bottom Sheet Drawer
    const mobileScrim = document.createElement('div');
    mobileScrim.className = 'room-drawer-scrim';
    mobileScrim.id = 'room-drawer-scrim';
    container.appendChild(mobileScrim);

    const mobileDrawer = document.createElement('section');
    mobileDrawer.className = 'room-mobile-drawer';
    mobileDrawer.id = 'room-mobile-drawer';
    mobileDrawer.setAttribute('aria-label', 'Exhibit Parameters Drawer');
    mobileDrawer.innerHTML = `
      <div class="room-drawer-header" id="room-drawer-header">
        <div class="room-drawer-handle" aria-hidden="true"></div>
        <div class="room-drawer-title-row">
          <h2 class="room-drawer-title">Parameters</h2>
          <button type="button" class="room-drawer-close" id="room-drawer-btn-close" aria-label="Close parameters drawer">
            &times;
          </button>
        </div>
      </div>
      <div class="room-drawer-body" id="room-mobile-drawer-body"></div>
    `;
    container.appendChild(mobileDrawer);

    app.appendChild(container);

    this.container = container;
    this.canvasContainer = canvasContainer;
    this.canvas = canvas;
    this.hudBar = hudBar;
    this.controlDock = controlDock;
    this.mobileDrawer = mobileDrawer;
    this.mobileScrim = mobileScrim;
    this.mobileToggleBtn = mobileToggleBtn;

    this.setupHUDButtonListeners();
  }

  /**
   * Initializes the sleek miniature Audio HUD Telemetry widget and visualizer loop.
   */
  private setupAudioTelemetry(): void {
    if (!this.container) return;

    const audioHud = document.createElement('aside');
    audioHud.className = 'room-audio-hud';
    audioHud.id = 'room-audio-hud';
    audioHud.setAttribute('aria-label', 'Audio Reactivity Telemetry HUD');

    audioHud.innerHTML = `
      <div class="audio-hud-header">
        <div class="audio-hud-status-group">
          <button type="button" class="audio-hud-source-pill source-synth" id="audio-hud-btn-source" title="Click to cycle source (Synth / Mic / Mute)">
            <span class="source-icon" id="audio-hud-source-icon">🎵</span>
            <span class="source-text" id="audio-hud-source-text">SYNTH</span>
          </button>
          <span class="audio-hud-beat-pill" id="audio-hud-beat-pill" title="Transient Beat Detection">✦ BEAT</span>
        </div>
        <div class="audio-hud-controls-group">
          <button type="button" class="audio-hud-icon-btn" id="audio-hud-btn-mic" title="Connect Microphone (M)" aria-label="Microphone Live Stream">
            🎙
          </button>
          <button type="button" class="audio-hud-icon-btn" id="audio-hud-btn-mute" title="Toggle Mute (U)" aria-label="Toggle Mute">
            🔊
          </button>
          <button type="button" class="audio-hud-icon-btn" id="audio-hud-btn-collapse" title="Collapse / Expand Visualizer" aria-label="Toggle Audio Visualizer" aria-expanded="true" aria-controls="audio-hud-body">
            ▾
          </button>
        </div>
      </div>

      <div class="audio-hud-body" id="audio-hud-body">
        <div class="audio-hud-viz-container">
          <canvas class="audio-hud-canvas" id="audio-hud-canvas" width="220" height="32" aria-label="Real-time FFT Spectrum"></canvas>
        </div>
        <div class="audio-hud-telemetry-row">
          <span class="audio-hud-stat">BASS <b id="audio-stat-bass">0.00</b></span>
          <span class="audio-hud-stat">MID <b id="audio-stat-mid">0.00</b></span>
          <span class="audio-hud-stat">TREB <b id="audio-stat-treb">0.00</b></span>
          <span class="audio-hud-stat">RMS <b id="audio-stat-vol">0.00</b></span>
        </div>
      </div>
    `;

    this.container.appendChild(audioHud);
    this.audioTelemetryWidget = audioHud;

    const canvas = audioHud.querySelector<HTMLCanvasElement>('#audio-hud-canvas');
    if (canvas) {
      this.audioCanvas = canvas;
      this.audioCanvasCtx = canvas.getContext('2d');
    }

    const signal = this.abortController?.signal;

    audioHud.querySelector('#audio-hud-btn-source')?.addEventListener('click', () => {
      this.toggleAudioSource();
    }, { signal });

    audioHud.querySelector('#audio-hud-btn-mic')?.addEventListener('click', () => {
      this.openMicPermissionModal();
    }, { signal });

    audioHud.querySelector('#audio-hud-btn-mute')?.addEventListener('click', () => {
      this.toggleAudioMute();
    }, { signal });

    audioHud.querySelector('#audio-hud-btn-collapse')?.addEventListener('click', () => {
      const isCollapsed = audioHud.classList.toggle('collapsed');
      const collapseBtn = audioHud.querySelector('#audio-hud-btn-collapse');
      if (collapseBtn) {
        collapseBtn.textContent = isCollapsed ? '▸' : '▾';
        collapseBtn.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
      }
      this.wakeHUD();
    }, { signal });

    // Prevent auto-dimming during interaction with audio HUD
    audioHud.addEventListener('pointerenter', () => { this.isInteractingWithControls = true; this.wakeHUD(); }, { signal });
    audioHud.addEventListener('pointerleave', () => { this.isInteractingWithControls = false; }, { signal });

    // Start Audio Visualizer Loop
    this.startAudioVisualizerLoop();
  }

  /**
   * Starts the 60 FPS real-time audio FFT visualizer and telemetry updater loop.
   */
  private startAudioVisualizerLoop(): void {
    const numBins = 24;
    if (this.peakHoldBins.length !== numBins) {
      this.peakHoldBins = new Float32Array(numBins);
    }

    const bassLabel = this.audioTelemetryWidget?.querySelector<HTMLElement>('#audio-stat-bass');
    const midLabel = this.audioTelemetryWidget?.querySelector<HTMLElement>('#audio-stat-mid');
    const trebLabel = this.audioTelemetryWidget?.querySelector<HTMLElement>('#audio-stat-treb');
    const volLabel = this.audioTelemetryWidget?.querySelector<HTMLElement>('#audio-stat-vol');
    const beatPill = this.audioTelemetryWidget?.querySelector<HTMLElement>('#audio-hud-beat-pill');

    const render = () => {
      if (this.isDestroyed) return;

      const bands = audioManager.getFrequencyBands();
      const bins = audioManager.getSpectrumBins(numBins);

      // Update text telemetry
      if (bassLabel) bassLabel.textContent = bands.bass.toFixed(2);
      if (midLabel) midLabel.textContent = bands.mid.toFixed(2);
      if (trebLabel) trebLabel.textContent = bands.treble.toFixed(2);
      if (volLabel) volLabel.textContent = bands.volume.toFixed(2);

      // Update transient beat indicator
      if (beatPill) {
        if (bands.isBeat || bands.transient > 0.35) {
          beatPill.classList.add('active');
        } else {
          beatPill.classList.remove('active');
        }
      }

      // Draw FFT Bars to Canvas
      if (this.audioCanvas && this.audioCanvasCtx && !this.audioTelemetryWidget?.classList.contains('collapsed')) {
        const ctx = this.audioCanvasCtx;
        const w = this.audioCanvas.width;
        const h = this.audioCanvas.height;

        ctx.clearRect(0, 0, w, h);

        const gap = 2;
        const barWidth = Math.max(2, Math.floor((w - (numBins - 1) * gap) / numBins));

        for (let i = 0; i < numBins; i++) {
          const val = Math.max(0, Math.min(1, bins[i]));
          const barHeight = Math.max(2, Math.round(val * (h - 4)));
          const x = i * (barWidth + gap);
          const y = h - barHeight;

          // Peak hold logic
          if (val >= this.peakHoldBins[i]) {
            this.peakHoldBins[i] = val;
          } else {
            this.peakHoldBins[i] = Math.max(0, this.peakHoldBins[i] - this.peakDecayRate);
          }
          const peakY = Math.max(0, Math.round(h - this.peakHoldBins[i] * (h - 4) - 2));

          // Color gradient across frequencies: Cyan (Bass) -> Mint (Mid) -> Amber (High Mid) -> Crimson (Treble)
          const ratio = i / (numBins - 1);
          let barColor = '#00F0FF';
          if (ratio > 0.7) {
            barColor = '#FF3366'; // Treble
          } else if (ratio > 0.45) {
            barColor = '#FFB800'; // Mid-high
          } else if (ratio > 0.2) {
            barColor = '#00FF9D'; // Mid
          }

          // Draw active spectrum bar
          ctx.fillStyle = barColor;
          ctx.fillRect(x, y, barWidth, barHeight);

          // Draw peak hold marker
          if (this.peakHoldBins[i] > 0.05) {
            ctx.fillStyle = '#F4F6FB';
            ctx.fillRect(x, peakY, barWidth, 1.5);
          }
        }
      }

      this.audioRafId = requestAnimationFrame(render);
    };

    this.audioRafId = requestAnimationFrame(render);
  }

  /**
   * Synchronizes Top HUD and Audio HUD UI indicators with current audio state.
   */
  private updateAudioHUDState(source: AudioSourceType, isRunning: boolean, isMuted: boolean): void {
    if (this.isDestroyed) return;

    // Update Top HUD Audio button
    const hudAudioBtn = this.hudBar?.querySelector<HTMLButtonElement>('#room-hud-btn-audio');
    const hudAudioIcon = this.hudBar?.querySelector<HTMLElement>('#room-hud-audio-icon');
    const hudAudioLabel = this.hudBar?.querySelector<HTMLElement>('#room-hud-audio-label');

    if (hudAudioBtn) {
      hudAudioBtn.classList.remove('state-synth', 'state-mic', 'state-muted', 'state-none');
      if (isMuted) {
        hudAudioBtn.classList.add('state-muted');
        if (hudAudioIcon) hudAudioIcon.textContent = '🔇';
        if (hudAudioLabel) hudAudioLabel.textContent = 'Muted';
      } else if (source === 'mic' && isRunning) {
        hudAudioBtn.classList.add('state-mic');
        if (hudAudioIcon) hudAudioIcon.textContent = '🎙';
        if (hudAudioLabel) hudAudioLabel.textContent = 'Mic Live';
      } else if (source === 'synth' && isRunning) {
        hudAudioBtn.classList.add('state-synth');
        if (hudAudioIcon) hudAudioIcon.textContent = '🎵';
        if (hudAudioLabel) hudAudioLabel.textContent = 'Synth';
      } else {
        hudAudioBtn.classList.add('state-none');
        if (hudAudioIcon) hudAudioIcon.textContent = '⏸';
        if (hudAudioLabel) hudAudioLabel.textContent = 'Audio Off';
      }
    }

    // Update Audio HUD widget
    if (this.audioTelemetryWidget) {
      const sourceBtn = this.audioTelemetryWidget.querySelector<HTMLElement>('#audio-hud-btn-source');
      const sourceIcon = this.audioTelemetryWidget.querySelector<HTMLElement>('#audio-hud-source-icon');
      const sourceText = this.audioTelemetryWidget.querySelector<HTMLElement>('#audio-hud-source-text');
      const muteBtn = this.audioTelemetryWidget.querySelector<HTMLElement>('#audio-hud-btn-mute');

      if (sourceBtn) {
        sourceBtn.classList.remove('source-synth', 'source-mic', 'source-muted', 'source-none');
        if (isMuted) {
          sourceBtn.classList.add('source-muted');
          if (sourceIcon) sourceIcon.textContent = '🔇';
          if (sourceText) sourceText.textContent = 'MUTED';
        } else if (source === 'mic' && isRunning) {
          sourceBtn.classList.add('source-mic');
          if (sourceIcon) sourceIcon.textContent = '🎙';
          if (sourceText) sourceText.textContent = 'MIC LIVE';
        } else if (source === 'synth' && isRunning) {
          sourceBtn.classList.add('source-synth');
          if (sourceIcon) sourceIcon.textContent = '🎵';
          if (sourceText) sourceText.textContent = 'SYNTH';
        } else {
          sourceBtn.classList.add('source-none');
          if (sourceIcon) sourceIcon.textContent = '⏸';
          if (sourceText) sourceText.textContent = 'IDLE';
        }
      }

      if (muteBtn) {
        muteBtn.textContent = isMuted ? '🔇' : '🔊';
        muteBtn.classList.toggle('muted', isMuted);
      }
    }
  }

  /**
   * Initializes and populates the Tweakpane parameter dock.
   */
  private setupControlDock(): void {
    if (!this.activeMetadata) return;

    const isMobile = window.innerWidth <= 640;
    const targetContainer = isMobile
      ? this.mobileDrawer?.querySelector<HTMLElement>('#room-mobile-drawer-body') || this.controlDock!
      : this.controlDock!;

    if (this.pane) {
      this.pane.dispose();
      this.pane = null;
    }

    const pane = new Pane({
      container: targetContainer,
      title: `${this.activeMetadata.name} Controls`,
      expanded: true,
    });

    // Group controls by folder
    const folderMap = new Map<string, any>();
    const controlsByFolder = new Map<string, ControlDef[]>();

    for (const ctrl of this.activeMetadata.controls) {
      const folderName = ctrl.folder || 'Parameters';
      if (!controlsByFolder.has(folderName)) {
        controlsByFolder.set(folderName, []);
      }
      controlsByFolder.get(folderName)!.push(ctrl);
    }

    for (const [folderName, controls] of controlsByFolder.entries()) {
      const folder = pane.addFolder({
        title: folderName,
        expanded: true,
      });
      folderMap.set(folderName, folder);

      for (const ctrl of controls) {
        if (ctrl.type === 'slider') {
          folder.addBinding(this.activeParams, ctrl.key, {
            min: ctrl.min,
            max: ctrl.max,
            step: ctrl.step,
            label: ctrl.label,
          });

          // Create discrete step buttons (+ / -) row for accessibility
          if (ctrl.step && ctrl.min !== undefined && ctrl.max !== undefined) {
            const stepVal = ctrl.step;
            const minVal = ctrl.min;
            const maxVal = ctrl.max;

            const stepperContainer = document.createElement('div');
            stepperContainer.className = 'room-stepper-row';
            stepperContainer.innerHTML = `
              <button type="button" class="room-stepper-btn" data-dir="-1" title="Step down ${ctrl.label}" aria-label="Step down ${ctrl.label}">−</button>
              <button type="button" class="room-stepper-btn" data-dir="1" title="Step up ${ctrl.label}" aria-label="Step up ${ctrl.label}">+</button>
              <span class="room-stepper-label">±${stepVal}</span>
            `;

            stepperContainer.addEventListener('click', (e) => {
              const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.room-stepper-btn');
              if (!btn) return;
              const dir = parseInt(btn.dataset.dir || '0', 10);
              const current = typeof this.activeParams[ctrl.key] === 'number' ? this.activeParams[ctrl.key] : minVal;
              const nextVal = Math.min(maxVal, Math.max(minVal, current + dir * stepVal));
              this.activeParams[ctrl.key] = parseFloat(nextVal.toFixed(4));
              pane.refresh();
              if (this.currentRoomInstance && typeof this.currentRoomInstance.updateParams === 'function') {
                this.currentRoomInstance.updateParams(this.activeParams);
              }
              this.debounceSyncURL();
            });

            if (folder.element && typeof folder.element.appendChild === 'function') {
              folder.element.appendChild(stepperContainer);
            } else if (targetContainer && typeof targetContainer.appendChild === 'function') {
              targetContainer.appendChild(stepperContainer);
            }
          }
        } else if (ctrl.type === 'select' && ctrl.options) {
          const optionsObj: Record<string, any> = {};
          for (const opt of ctrl.options) {
            optionsObj[opt.label] = opt.value;
          }
          folder.addBinding(this.activeParams, ctrl.key, {
            options: optionsObj,
            label: ctrl.label,
          });
        } else if (ctrl.type === 'boolean') {
          folder.addBinding(this.activeParams, ctrl.key, {
            label: ctrl.label,
          });
        } else if (ctrl.type === 'color') {
          folder.addBinding(this.activeParams, ctrl.key, {
            label: ctrl.label,
            view: 'color',
          });
        } else if (ctrl.type === 'button') {
          folder.addButton({
            title: ctrl.label,
          }).on('click', () => {
            if (typeof ctrl.action === 'function') {
              ctrl.action();
            }
          });
        }
      }
    }

    pane.on('change', () => {
      this.wakeHUD();
      if (this.currentRoomInstance && typeof this.currentRoomInstance.updateParams === 'function') {
        this.currentRoomInstance.updateParams(this.activeParams);
      }
      this.debounceSyncURL();
    });

    this.pane = pane;

    // Track active user interaction with controls to prevent auto-dimming
    const bindControlFocus = (el: HTMLElement | null) => {
      if (!el) return;
      el.addEventListener('pointerenter', () => { this.isInteractingWithControls = true; this.wakeHUD(); });
      el.addEventListener('pointerleave', () => { this.isInteractingWithControls = false; });
      el.addEventListener('focusin', () => { this.isInteractingWithControls = true; this.wakeHUD(); });
      el.addEventListener('focusout', () => { this.isInteractingWithControls = false; });
    };

    bindControlFocus(this.controlDock);
    bindControlFocus(this.mobileDrawer);
  }

  /**
   * Debounces URL hash synchronization to prevent excessive history calls during rapid slider dragging.
   */
  private debounceSyncURL(): void {
    if (this.urlDebounceTimer !== null) {
      clearTimeout(this.urlDebounceTimer);
    }
    this.urlDebounceTimer = window.setTimeout(() => {
      if (this.activeRoomId && this.activeMetadata && !this.isDestroyed) {
        syncStateToURL(this.activeRoomId, this.activeParams, this.activeMetadata.defaultParams, true);
      }
    }, 200);
  }

  /**
   * Attaches click event listeners to the Top HUD buttons.
   */
  private setupHUDButtonListeners(): void {
    if (!this.hudBar) return;
    const signal = this.abortController?.signal;

    // Back to Gallery
    const backBtn = this.hudBar.querySelector('#room-hud-btn-back');
    backBtn?.addEventListener('click', () => {
      router.navigateToGallery();
    }, { signal });

    // Audio Reactivity Toggle
    const audioBtn = this.hudBar.querySelector('#room-hud-btn-audio');
    audioBtn?.addEventListener('click', () => {
      this.toggleAudioSource();
    }, { signal });

    // Randomize Seed
    const seedBtn = this.hudBar.querySelector('#room-hud-btn-seed');
    seedBtn?.addEventListener('click', () => {
      this.randomizeSeed();
    }, { signal });

    // Reset Defaults
    const resetBtn = this.hudBar.querySelector('#room-hud-btn-reset');
    resetBtn?.addEventListener('click', () => {
      this.resetDefaults();
    }, { signal });

    // Snapshot Modal Trigger
    const snapBtn = this.hudBar.querySelector('#room-hud-btn-snapshot');
    snapBtn?.addEventListener('click', () => {
      this.openSnapshotModal();
    }, { signal });

    // Video Loop Modal Trigger
    const recordBtn = this.hudBar.querySelector('#room-hud-btn-record');
    recordBtn?.addEventListener('click', () => {
      this.openVideoModal();
    }, { signal });

    // Share Link
    const shareBtn = this.hudBar.querySelector('#room-hud-btn-share');
    shareBtn?.addEventListener('click', () => {
      this.shareURL();
    }, { signal });

    // Fullscreen Toggle
    const fsBtn = this.hudBar.querySelector('#room-hud-btn-fullscreen');
    fsBtn?.addEventListener('click', () => {
      this.toggleFullscreen();
    }, { signal });
  }

  /**
   * Sets up mobile bottom-sheet drawer interactions and toggle triggers.
   */
  private setupMobileDrawer(): void {
    const signal = this.abortController?.signal;

    this.mobileToggleBtn?.setAttribute('aria-expanded', 'false');
    this.mobileToggleBtn?.setAttribute('aria-haspopup', 'dialog');
    this.mobileToggleBtn?.setAttribute('aria-controls', 'room-mobile-drawer');

    const openDrawer = () => {
      this.isMobileDrawerOpen = true;
      this.mobileToggleBtn?.setAttribute('aria-expanded', 'true');
      this.mobileDrawer?.classList.add('open');
      this.mobileScrim?.classList.add('open');
      this.wakeHUD();

      const closeBtn = this.mobileDrawer?.querySelector<HTMLButtonElement>('#room-drawer-btn-close');
      closeBtn?.focus();
    };

    const closeDrawer = () => {
      this.isMobileDrawerOpen = false;
      this.mobileToggleBtn?.setAttribute('aria-expanded', 'false');
      this.mobileDrawer?.classList.remove('open');
      this.mobileScrim?.classList.remove('open');
      this.wakeHUD();

      if (this.mobileToggleBtn && typeof this.mobileToggleBtn.focus === 'function') {
        this.mobileToggleBtn.focus();
      }
    };

    this.mobileToggleBtn?.addEventListener('click', openDrawer, { signal });
    this.mobileScrim?.addEventListener('click', closeDrawer, { signal });

    const closeBtn = this.mobileDrawer?.querySelector('#room-drawer-btn-close');
    closeBtn?.addEventListener('click', closeDrawer, { signal });

    const drawerHeader = this.mobileDrawer?.querySelector<HTMLElement>('#room-drawer-header');
    drawerHeader?.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('#room-drawer-btn-close')) return;
      closeDrawer();
    }, { signal });

    // Touch swipe-down to dismiss drawer gesture
    let touchStartY = 0;
    let touchCurrentY = 0;
    let isSwiping = false;

    drawerHeader?.addEventListener('touchstart', (e: TouchEvent) => {
      if (e.touches.length === 1) {
        touchStartY = e.touches[0].clientY;
        touchCurrentY = touchStartY;
        isSwiping = true;
      }
    }, { passive: true, signal });

    drawerHeader?.addEventListener('touchmove', (e: TouchEvent) => {
      if (isSwiping && e.touches.length === 1 && this.mobileDrawer) {
        touchCurrentY = e.touches[0].clientY;
        const deltaY = touchCurrentY - touchStartY;
        if (deltaY > 0) {
          this.mobileDrawer.style.transform = `translateY(${deltaY}px)`;
        }
      }
    }, { passive: true, signal });

    const endSwipe = () => {
      if (isSwiping && this.mobileDrawer) {
        isSwiping = false;
        const deltaY = touchCurrentY - touchStartY;
        this.mobileDrawer.style.transform = '';
        if (deltaY > 40) {
          closeDrawer();
        }
      }
    };

    drawerHeader?.addEventListener('touchend', endSwipe, { signal });
    drawerHeader?.addEventListener('touchcancel', endSwipe, { signal });
  }

  /**
   * Renders the High-Resolution Snapshot Modal.
   */
  private renderSnapshotModal(): void {
    if (!this.container) return;

    const overlay = document.createElement('div');
    overlay.className = 'room-modal-overlay hidden';
    overlay.id = 'room-snapshot-modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'High-Resolution Snapshot Export');

    overlay.innerHTML = `
      <div class="room-modal-card">
        <div class="room-modal-header">
          <div class="room-modal-title-group">
            <h2 class="room-modal-title">Snapshot Export</h2>
            <span class="room-modal-badge">STILL IMAGE</span>
          </div>
          <button type="button" class="room-modal-close" id="snap-modal-btn-close" aria-label="Close modal">&times;</button>
        </div>

        <div class="room-modal-body">
          <div class="room-modal-section">
            <span class="room-modal-section-title">Resolution Scale</span>
            <div class="room-modal-choice-grid">
              <button type="button" class="room-modal-choice-btn" data-scale="1">
                <span class="room-modal-choice-label">1x Native</span>
                <span class="room-modal-choice-sub">Display Size</span>
              </button>
              <button type="button" class="room-modal-choice-btn active" data-scale="2">
                <span class="room-modal-choice-label">2x Ultra-HD</span>
                <span class="room-modal-choice-sub">4K Ready</span>
              </button>
              <button type="button" class="room-modal-choice-btn" data-scale="4">
                <span class="room-modal-choice-label">4x Archival</span>
                <span class="room-modal-choice-sub">8K Master</span>
              </button>
            </div>
          </div>

          <div class="room-modal-section">
            <span class="room-modal-section-title">Image Format</span>
            <div class="room-modal-choice-grid">
              <button type="button" class="room-modal-choice-btn active" data-fmt="image/png">
                <span class="room-modal-choice-label">PNG</span>
                <span class="room-modal-choice-sub">Lossless</span>
              </button>
              <button type="button" class="room-modal-choice-btn" data-fmt="image/jpeg">
                <span class="room-modal-choice-label">JPEG</span>
                <span class="room-modal-choice-sub">95% High</span>
              </button>
              <button type="button" class="room-modal-choice-btn" data-fmt="image/webp">
                <span class="room-modal-choice-label">WebP</span>
                <span class="room-modal-choice-sub">Compact</span>
              </button>
            </div>
          </div>

          <div class="room-modal-info-strip" id="snap-modal-info">
            <span>Dimensions: Calculating...</span>
            <span id="snap-modal-seed">Seed: ${this.activeParams.seed}</span>
          </div>

          <div class="room-modal-progress-bar" id="snap-modal-progress">
            <div class="room-modal-progress-fill" id="snap-modal-progress-fill"></div>
          </div>
        </div>

        <div class="room-modal-actions">
          <button type="button" class="room-btn-secondary" id="snap-modal-btn-cancel">Cancel</button>
          <button type="button" class="room-btn-primary" id="snap-modal-btn-capture">
            <span class="btn-text">Capture Snapshot</span>
          </button>
        </div>
      </div>
    `;

    this.container.appendChild(overlay);
    this.snapshotModal = overlay;

    const signal = this.abortController?.signal;

    // Close buttons
    overlay.querySelector('#snap-modal-btn-close')?.addEventListener('click', () => this.closeSnapshotModal(), { signal });
    overlay.querySelector('#snap-modal-btn-cancel')?.addEventListener('click', () => this.closeSnapshotModal(), { signal });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.closeSnapshotModal();
    }, { signal });

    // Scale buttons
    const scaleBtns = overlay.querySelectorAll<HTMLButtonElement>('[data-scale]');
    scaleBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        scaleBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeSnapshotScale = parseInt(btn.dataset.scale || '2', 10) as 1 | 2 | 4;
        this.updateSnapshotInfoStrip();
      }, { signal });
    });

    // Format buttons
    const fmtBtns = overlay.querySelectorAll<HTMLButtonElement>('[data-fmt]');
    fmtBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        fmtBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeSnapshotFormat = (btn.dataset.fmt || 'image/png') as any;
        this.updateSnapshotInfoStrip();
      }, { signal });
    });

    // Capture Trigger
    const captureBtn = overlay.querySelector<HTMLButtonElement>('#snap-modal-btn-capture');
    captureBtn?.addEventListener('click', async () => {
      if (this.isSnapshotInProgress || !this.canvas) return;
      this.isSnapshotInProgress = true;
      captureBtn.disabled = true;

      const progressBar = overlay.querySelector<HTMLElement>('#snap-modal-progress');
      const progressFill = overlay.querySelector<HTMLElement>('#snap-modal-progress-fill');
      const btnText = captureBtn.querySelector<HTMLElement>('.btn-text');

      if (progressBar) progressBar.classList.add('active');
      if (btnText) btnText.textContent = 'Rendering Buffer...';

      try {
        await captureSnapshot(this.canvas, {
          resolutionScale: this.activeSnapshotScale,
          format: this.activeSnapshotFormat,
          filenamePrefix: `aurora-${this.activeRoomId || 'exhibit'}`,
          seed: this.activeParams.seed,
          autoDownload: true,
          onProgress: (ratio) => {
            if (progressFill) progressFill.style.width = `${Math.round(ratio * 100)}%`;
          },
        });

        this.showToast(`Snapshot Captured (${this.activeSnapshotScale}x)`);
        this.closeSnapshotModal();
      } catch (err) {
        console.error('Snapshot capture error:', err);
        this.showToast('Snapshot capture failed');
      } finally {
        this.isSnapshotInProgress = false;
        captureBtn.disabled = false;
        if (progressBar) progressBar.classList.remove('active');
        if (progressFill) progressFill.style.width = '0%';
        if (btnText) btnText.textContent = 'Capture Snapshot';
      }
    }, { signal });
  }

  /**
   * Updates the live dimension display in the snapshot modal.
   */
  private updateSnapshotInfoStrip(): void {
    if (!this.snapshotModal || !this.canvas) return;
    const targetW = Math.round(this.canvas.width * this.activeSnapshotScale);
    const targetH = Math.round(this.canvas.height * this.activeSnapshotScale);
    const infoStrip = this.snapshotModal.querySelector('#snap-modal-info');
    if (infoStrip) {
      infoStrip.innerHTML = `
        <span>Output: ${targetW} × ${targetH} px</span>
        <span>Seed: ${this.activeParams.seed || 'DEFAULT'}</span>
      `;
    }
  }

  /**
   * Renders the Video Loop Recording Modal.
   */
  private renderVideoModal(): void {
    if (!this.container) return;

    const overlay = document.createElement('div');
    overlay.className = 'room-modal-overlay hidden';
    overlay.id = 'room-video-modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'Video Loop Recording');

    const { mimeType } = negotiateSupportedVideoCodec();
    const codecLabel = mimeType.includes('vp9')
      ? 'WebM (VP9 Lossless)'
      : mimeType.includes('avc1')
      ? 'MP4 (AVC1 / H.264)'
      : 'WebM Video';

    overlay.innerHTML = `
      <div class="room-modal-card">
        <div class="room-modal-header">
          <div class="room-modal-title-group">
            <h2 class="room-modal-title">Record Video Loop</h2>
            <span class="room-modal-badge">60 FPS LOOP</span>
          </div>
          <button type="button" class="room-modal-close" id="video-modal-btn-close" aria-label="Close modal">&times;</button>
        </div>

        <div class="room-modal-body">
          <div class="room-progress-ring-container" id="video-progress-container" style="display: none;">
            <svg class="room-progress-ring-svg" viewBox="0 0 100 100">
              <circle class="room-progress-ring-bg" cx="50" cy="50" r="45"></circle>
              <circle class="room-progress-ring-fill" id="video-ring-fill" cx="50" cy="50" r="45"></circle>
            </svg>
            <span class="room-progress-ring-label" id="video-ring-countdown">5.0s</span>
            <span class="room-progress-ring-status" id="video-ring-status">STREAMING FRAMES...</span>
          </div>

          <div id="video-settings-container">
            <div class="room-modal-section">
              <span class="room-modal-section-title">Loop Duration</span>
              <div class="room-modal-choice-grid">
                <button type="button" class="room-modal-choice-btn active" data-dur="5">
                  <span class="room-modal-choice-label">5 Seconds</span>
                  <span class="room-modal-choice-sub">Social Loop</span>
                </button>
                <button type="button" class="room-modal-choice-btn" data-dur="10">
                  <span class="room-modal-choice-label">10 Seconds</span>
                  <span class="room-modal-choice-sub">Extended</span>
                </button>
                <button type="button" class="room-modal-choice-btn" data-dur="15">
                  <span class="room-modal-choice-label">15 Seconds</span>
                  <span class="room-modal-choice-sub">Long Loop</span>
                </button>
              </div>
            </div>

            <div class="room-modal-section" style="margin-top: var(--space-3);">
              <span class="room-modal-section-title">Target Framerate</span>
              <div class="room-modal-choice-grid">
                <button type="button" class="room-modal-choice-btn active" data-fps="60">
                  <span class="room-modal-choice-label">60 FPS</span>
                  <span class="room-modal-choice-sub">Ultra-Smooth</span>
                </button>
                <button type="button" class="room-modal-choice-btn" data-fps="30">
                  <span class="room-modal-choice-label">30 FPS</span>
                  <span class="room-modal-choice-sub">Standard</span>
                </button>
                <button type="button" class="room-modal-choice-btn" data-fps="24">
                  <span class="room-modal-choice-label">24 FPS</span>
                  <span class="room-modal-choice-sub">Cinematic</span>
                </button>
              </div>
            </div>

            <div class="room-modal-info-strip" style="margin-top: var(--space-3);">
              <span>Codec: ${codecLabel}</span>
              <span>12 Mbps High</span>
            </div>
          </div>
        </div>

        <div class="room-modal-actions">
          <button type="button" class="room-btn-secondary" id="video-modal-btn-cancel">Cancel</button>
          <button type="button" class="room-btn-primary" id="video-modal-btn-record">
            <span class="btn-text">Start Recording</span>
          </button>
        </div>
      </div>
    `;

    this.container.appendChild(overlay);
    this.videoModal = overlay;

    const signal = this.abortController?.signal;

    // Close buttons
    overlay.querySelector('#video-modal-btn-close')?.addEventListener('click', () => this.closeVideoModal(), { signal });
    overlay.querySelector('#video-modal-btn-cancel')?.addEventListener('click', () => this.closeVideoModal(), { signal });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.closeVideoModal();
    }, { signal });

    // Duration buttons
    const durBtns = overlay.querySelectorAll<HTMLButtonElement>('[data-dur]');
    durBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        durBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeVideoDuration = parseInt(btn.dataset.dur || '5', 10);
      }, { signal });
    });

    // FPS buttons
    const fpsBtns = overlay.querySelectorAll<HTMLButtonElement>('[data-fps]');
    fpsBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        fpsBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeVideoFPS = parseInt(btn.dataset.fps || '60', 10);
      }, { signal });
    });

    // Start Recording Trigger
    const recordBtn = overlay.querySelector<HTMLButtonElement>('#video-modal-btn-record');
    const settingsContainer = overlay.querySelector<HTMLElement>('#video-settings-container');
    const progressContainer = overlay.querySelector<HTMLElement>('#video-progress-container');
    const ringFill = overlay.querySelector<HTMLElement>('#video-ring-fill');
    const countdownLabel = overlay.querySelector<HTMLElement>('#video-ring-countdown');
    const statusLabel = overlay.querySelector<HTMLElement>('#video-ring-status');

    recordBtn?.addEventListener('click', async () => {
      if (!this.canvas) return;

      if (this.isRecordingInProgress) {
        cancelVideoRecording();
        this.isRecordingInProgress = false;
        this.closeVideoModal();
        return;
      }

      this.isRecordingInProgress = true;
      if (recordBtn) recordBtn.querySelector('.btn-text')!.textContent = 'Cancel Recording';
      if (settingsContainer) settingsContainer.style.display = 'none';
      if (progressContainer) progressContainer.style.display = 'flex';

      const totalDuration = this.activeVideoDuration;

      try {
        await recordVideoLoop(this.canvas, {
          durationSeconds: totalDuration,
          fps: this.activeVideoFPS,
          filenamePrefix: `aurora-${this.activeRoomId || 'exhibit'}`,
          seed: this.activeParams.seed,
          autoDownload: true,
          onProgress: (ratio, elapsedMs) => {
            const circumference = 283;
            const offset = circumference * (1 - ratio);
            if (ringFill) ringFill.style.strokeDashoffset = String(offset);
            const remaining = Math.max(0, totalDuration - elapsedMs / 1000);
            if (countdownLabel) countdownLabel.textContent = `${remaining.toFixed(1)}s`;
            if (statusLabel) {
              statusLabel.textContent = ratio >= 0.98 ? 'COMPILING VIDEO...' : 'STREAMING CANVAS...';
            }
          },
        });

        this.showToast(`Video Loop Exported (${totalDuration}s @ ${this.activeVideoFPS}fps)`);
        this.closeVideoModal();
      } catch (err) {
        console.error('Video recording error:', err);
        this.showToast('Video recording failed');
      } finally {
        this.isRecordingInProgress = false;
        if (recordBtn) recordBtn.querySelector('.btn-text')!.textContent = 'Start Recording';
        if (settingsContainer) settingsContainer.style.display = 'block';
        if (progressContainer) progressContainer.style.display = 'none';
      }
    }, { signal });
  }

  /**
   * Renders the Microphone Permission & Local Spectral Analysis Modal.
   */
  private renderMicPermissionModal(): void {
    if (!this.container) return;

    const overlay = document.createElement('div');
    overlay.className = 'room-modal-overlay hidden';
    overlay.id = 'room-mic-modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'Microphone Access & Spectral Analysis');

    overlay.innerHTML = `
      <div class="room-modal-card room-mic-modal-card">
        <div class="room-modal-header">
          <div class="room-modal-title-group">
            <h2 class="room-modal-title">Live Audio Stream</h2>
            <span class="room-modal-badge badge-privacy">LOCAL FFT ONLY</span>
          </div>
          <button type="button" class="room-modal-close" id="mic-modal-btn-close" aria-label="Close modal">&times;</button>
        </div>

        <div class="room-modal-body">
          <div class="room-mic-explainer">
            <p class="room-mic-desc">
              Aurora transforms acoustic vibrations into algorithmic kinetic motion using high-precision Web Audio API Fast Fourier Transform (FFT) spectral decomposition.
            </p>
            <div class="room-mic-privacy-box">
              <div class="privacy-header">
                <span class="privacy-icon" aria-hidden="true">🛡️</span>
                <span class="privacy-title">Privacy & Local Processing Guarantee</span>
              </div>
              <ul class="privacy-list">
                <li><strong>Zero Recording:</strong> Audio signals are never recorded or written to disk.</li>
                <li><strong>Zero Transmission:</strong> Audio data never leaves your device or browser memory.</li>
                <li><strong>Instant Disposal:</strong> Real-time frequency bins are computed per-frame and immediately overwritten.</li>
              </ul>
            </div>
            <div class="room-mic-bands-preview">
              <div class="mic-band-item">
                <span class="band-tag">BASS [20–250Hz]</span>
                <span class="band-desc">Shockwaves, Pulsation & Scale</span>
              </div>
              <div class="mic-band-item">
                <span class="band-tag">MID [250–2500Hz]</span>
                <span class="band-desc">Rotation, Flow & Velocity</span>
              </div>
              <div class="mic-band-item">
                <span class="band-tag">TREBLE [2.5–12kHz]</span>
                <span class="band-desc">Dispersion, Shimmer & Transients</span>
              </div>
            </div>
          </div>
        </div>

        <div class="room-modal-actions">
          <button type="button" class="room-btn-secondary" id="mic-modal-btn-synth">
            Use Ambient Synth
          </button>
          <button type="button" class="room-btn-primary" id="mic-modal-btn-allow">
            <span class="btn-text">🎙 Connect Microphone</span>
          </button>
        </div>
      </div>
    `;

    this.container.appendChild(overlay);
    this.micPermissionModal = overlay;

    const signal = this.abortController?.signal;

    overlay.querySelector('#mic-modal-btn-close')?.addEventListener('click', () => this.closeMicPermissionModal(), { signal });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.closeMicPermissionModal();
    }, { signal });

    // "Use Ambient Synth" button
    overlay.querySelector('#mic-modal-btn-synth')?.addEventListener('click', async () => {
      await audioManager.startSynth();
      this.showToast('Ambient Synth Active');
      this.closeMicPermissionModal();
    }, { signal });

    // "Connect Microphone" button
    overlay.querySelector('#mic-modal-btn-allow')?.addEventListener('click', async () => {
      const allowBtn = overlay.querySelector<HTMLButtonElement>('#mic-modal-btn-allow');
      const btnText = allowBtn?.querySelector<HTMLElement>('.btn-text');
      if (btnText) btnText.textContent = 'Requesting Stream...';
      if (allowBtn) allowBtn.disabled = true;

      try {
        const success = await audioManager.connectMicrophone();
        if (success) {
          this.showToast('Microphone Connected (Live FFT Active)');
          this.closeMicPermissionModal();
        } else {
          this.showToast('Microphone access denied. Falling back to synth.');
          this.closeMicPermissionModal();
        }
      } catch (err) {
        console.warn('Microphone request error:', err);
        this.showToast('Microphone error. Using ambient synth.');
        this.closeMicPermissionModal();
      } finally {
        if (allowBtn) allowBtn.disabled = false;
        if (btnText) btnText.textContent = '🎙 Connect Microphone';
      }
    }, { signal });
  }

  /**
   * Sets up 3000ms idle timer for auto-dimming the HUD and controls.
   */
  private setupAutoDimming(): void {
    if (typeof window === 'undefined') return;

    const wakeHandler = () => {
      this.wakeHUD();
    };

    const events = ['pointermove', 'pointerdown', 'keydown', 'touchstart', 'touchmove', 'wheel'];
    for (const evt of events) {
      window.addEventListener(evt, wakeHandler, {
        passive: true,
        signal: this.abortController?.signal,
      });
    }

    this.startIdleTimer();
  }

  /**
   * Wakes up the HUD and resets the idle countdown timer.
   */
  private wakeHUD(): void {
    if (this.isDestroyed) return;

    if (this.isHUDDimmed && !this.isHUDHidden) {
      this.isHUDDimmed = false;
      this.container?.classList.remove('hud-dimmed');
    }

    this.startIdleTimer();
  }

  /**
   * Starts or restarts the 3000ms idle countdown timer.
   */
  private startIdleTimer(): void {
    if (this.idleTimeoutTimer !== null) {
      clearTimeout(this.idleTimeoutTimer);
    }

    this.idleTimeoutTimer = window.setTimeout(() => {
      if (
        this.isDestroyed ||
        this.isHUDHidden ||
        this.isInteractingWithControls ||
        this.isMobileDrawerOpen ||
        (this.snapshotModal && !this.snapshotModal.classList.contains('hidden')) ||
        (this.videoModal && !this.videoModal.classList.contains('hidden')) ||
        (this.micPermissionModal && !this.micPermissionModal.classList.contains('hidden'))
      ) {
        return;
      }
      this.isHUDDimmed = true;
      this.container?.classList.add('hud-dimmed');
    }, 3000);
  }

  /**
   * Listens for browser fullscreen changes and updates the HUD icon state.
   */
  private setupFullscreenListener(): void {
    if (typeof document === 'undefined') return;

    document.addEventListener('fullscreenchange', () => {
      if (this.isDestroyed || !this.hudBar) return;
      const fsBtn = this.hudBar.querySelector('#room-hud-btn-fullscreen');
      const fsIcon = fsBtn?.querySelector('.fs-icon');
      const isFullscreen = !!document.fullscreenElement;

      if (fsBtn) {
        fsBtn.classList.toggle('active', isFullscreen);
        fsBtn.setAttribute('aria-label', isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen');
        fsBtn.setAttribute('title', isFullscreen ? 'Exit Fullscreen (F)' : 'Toggle Fullscreen (F)');
      }
      if (fsIcon) {
        fsIcon.textContent = isFullscreen ? '🗗' : '⛶';
      }
    }, { signal: this.abortController?.signal });
  }

  /**
   * Attaches comprehensive keyboard shortcuts for in-room operations:
   * - Space: Toggle Pause / Resume
   * - R: Randomize Seed
   * - S: Open High-Res Snapshot Modal
   * - L: Open Video Loop Export Modal
   * - A: Toggle Audio Source / Open Audio Modal
   * - M: Toggle Audio Mute
   * - C: Copy Share Link
   * - F: Toggle Fullscreen
   * - Esc: Close Modals / Close Drawer / Return to Gallery
   * - H: Toggle HUD Visibility
   */
  private setupKeyboardShortcuts(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (this.isDestroyed) return;

      // Check if any modal is currently open and trap Tab inside it
      const activeModal =
        (this.snapshotModal && !this.snapshotModal.classList.contains('hidden') && this.snapshotModal) ||
        (this.videoModal && !this.videoModal.classList.contains('hidden') && this.videoModal) ||
        (this.micPermissionModal && !this.micPermissionModal.classList.contains('hidden') && this.micPermissionModal);

      if (activeModal && e.key === 'Tab') {
        const focusable = Array.from(
          activeModal.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        ).filter(el => el.offsetParent !== null || el.offsetWidth > 0 || el.offsetHeight > 0);

        if (focusable.length > 0) {
          const firstEl = focusable[0];
          const lastEl = focusable[focusable.length - 1];

          if (e.shiftKey) {
            if (document.activeElement === firstEl) {
              e.preventDefault();
              lastEl.focus();
            }
          } else {
            if (document.activeElement === lastEl) {
              e.preventDefault();
              firstEl.focus();
            }
          }
        }
        return;
      }

      // Ignore shortcuts when focused inside an input/textarea/select
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        this.togglePause();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        this.randomizeSeed();
      } else if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        this.toggleAudioSource();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        this.toggleAudioMute();
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        if (this.snapshotModal && !this.snapshotModal.classList.contains('hidden')) {
          this.closeSnapshotModal();
        } else {
          this.openSnapshotModal();
        }
      } else if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        if (this.videoModal && !this.videoModal.classList.contains('hidden')) {
          this.closeVideoModal();
        } else {
          this.openVideoModal();
        }
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        this.shareURL();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        this.toggleFullscreen();
      } else if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        this.toggleHUDVisibility();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (this.micPermissionModal && !this.micPermissionModal.classList.contains('hidden')) {
          this.closeMicPermissionModal();
        } else if (this.snapshotModal && !this.snapshotModal.classList.contains('hidden')) {
          this.closeSnapshotModal();
        } else if (this.videoModal && !this.videoModal.classList.contains('hidden')) {
          this.closeVideoModal();
        } else if (this.isMobileDrawerOpen) {
          this.isMobileDrawerOpen = false;
          this.mobileDrawer?.classList.remove('open');
          this.mobileScrim?.classList.remove('open');
        } else {
          router.navigateToGallery();
        }
      }
    }, { signal: this.abortController?.signal });
  }

  /**
   * Inspects hardware capabilities and renders a non-blocking archival banner
   * if WebGPU compute is required by the exhibit but unsupported on the client device.
   */
  private checkHardwareCapabilities(metadata: RoomMetadata, caps: GPUCapabilities): void {
    const isComputeHeavy = metadata.backend === 'webgpu-compute';
    const isFallbackMode = !caps.hasWebGPU || caps.tier !== 'webgpu-full';

    if (isComputeHeavy && isFallbackMode) {
      const banner = document.createElement('div');
      banner.className = 'room-gpu-banner';
      banner.setAttribute('role', 'status');
      banner.setAttribute('aria-live', 'polite');

      banner.innerHTML = `
        <span class="room-gpu-banner-icon" aria-hidden="true">▲</span>
        <div class="room-gpu-banner-content">
          <span class="room-gpu-banner-title">WebGPU Compute Required for 500K+ particles</span>
          <span class="room-gpu-banner-desc">— running lightweight ${caps.hasWebGL2 ? 'WebGL2' : 'Canvas2D'} preview</span>
        </div>
        <button type="button" class="room-gpu-banner-dismiss" aria-label="Dismiss hardware notice" title="Dismiss notice">
          &times;
        </button>
      `;

      const dismissBtn = banner.querySelector('.room-gpu-banner-dismiss');
      dismissBtn?.addEventListener('click', () => {
        banner.classList.add('closing');
        setTimeout(() => {
          if (banner.parentNode) {
            banner.parentNode.removeChild(banner);
          }
          if (this.gpuBanner === banner) {
            this.gpuBanner = null;
          }
        }, 200);
      }, { signal: this.abortController?.signal });

      this.container?.appendChild(banner);
      this.gpuBanner = banner;
    }
  }

  /**
   * Sets up ResizeObserver on canvas container and debounced window resize listener.
   */
  private setupResizeHandling(): void {
    if (!this.canvasContainer) return;

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.handleResize();
      });
      this.resizeObserver.observe(this.canvasContainer);
    }

    window.addEventListener(
      'resize',
      () => {
        this.handleResize();
      },
      { signal: this.abortController?.signal }
    );
  }

  /**
   * Handles canvas dimension updates with debouncing and re-adjusts Tweakpane container if crossing mobile threshold.
   */
  private handleResize(): void {
    if (this.isDestroyed || !this.canvas || !this.canvasContainer) return;

    if (this.resizeDebounceTimer !== null) {
      clearTimeout(this.resizeDebounceTimer);
    }

    this.resizeDebounceTimer = window.setTimeout(() => {
      this.resizeCanvasBuffer();
      // Re-mount Tweakpane if viewport crossed desktop/mobile boundary
      const isMobile = window.innerWidth <= 640;
      const target = isMobile
        ? this.mobileDrawer?.querySelector<HTMLElement>('#room-mobile-drawer-body')
        : this.controlDock;

      if (target && this.pane?.element && this.pane.element.parentElement !== target) {
        target.appendChild(this.pane.element);
      }
    }, 50);
  }

  /**
   * Recalculates canvas buffer dimensions based on container bounding box and clamped DPR.
   */
  private resizeCanvasBuffer(): void {
    if (this.isDestroyed || !this.canvas || !this.canvasContainer) return;

    const rect = this.canvasContainer.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));

    this.dpr = getClampedDPR(2.0);
    const bufferWidth = Math.floor(width * this.dpr);
    const bufferHeight = Math.floor(height * this.dpr);

    if (this.canvas.width !== bufferWidth || this.canvas.height !== bufferHeight) {
      this.canvas.width = bufferWidth;
      this.canvas.height = bufferHeight;
    }

    if (this.currentRoomInstance && typeof this.currentRoomInstance.resize === 'function') {
      this.currentRoomInstance.resize(width, height);
    }
  }

  /**
   * Attaches pointer event listeners to capture gestures, mouse coordinates, and touch inputs.
   */
  private setupPointerListeners(): void {
    if (!this.canvasContainer) return;

    const signal = this.abortController?.signal;

    const dispatchPointerEvent = (type: RoomPointerEvent['type'], e: PointerEvent) => {
      if (!this.canvasContainer || !this.currentRoomInstance || typeof this.currentRoomInstance.onPointer !== 'function') {
        return;
      }

      const rect = this.canvasContainer.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const normalizedX = rect.width > 0 ? Math.max(0, Math.min(1, x / rect.width)) : 0.5;
      const normalizedY = rect.height > 0 ? Math.max(0, Math.min(1, y / rect.height)) : 0.5;

      const event: RoomPointerEvent = {
        type,
        x,
        y,
        normalizedX,
        normalizedY,
        isDown: this.isPointerDown,
      };

      this.currentRoomInstance.onPointer(event);
    };

    this.canvasContainer.addEventListener(
      'pointerdown',
      (e: PointerEvent) => {
        this.isPointerDown = true;
        try {
          this.canvasContainer?.setPointerCapture?.(e.pointerId);
        } catch {}
        dispatchPointerEvent('down', e);
      },
      { signal }
    );

    this.canvasContainer.addEventListener(
      'pointermove',
      (e: PointerEvent) => {
        dispatchPointerEvent('move', e);
      },
      { signal }
    );

    this.canvasContainer.addEventListener(
      'pointerup',
      (e: PointerEvent) => {
        this.isPointerDown = false;
        try {
          if (this.canvasContainer?.hasPointerCapture?.(e.pointerId)) {
            this.canvasContainer?.releasePointerCapture?.(e.pointerId);
          }
        } catch {}
        dispatchPointerEvent('up', e);
      },
      { signal }
    );

    this.canvasContainer.addEventListener(
      'pointerleave',
      (e: PointerEvent) => {
        this.isPointerDown = false;
        dispatchPointerEvent('leave', e);
      },
      { signal }
    );

    this.canvasContainer.addEventListener(
      'pointercancel',
      (e: PointerEvent) => {
        this.isPointerDown = false;
        try {
          if (this.canvasContainer?.hasPointerCapture?.(e.pointerId)) {
            this.canvasContainer?.releasePointerCapture?.(e.pointerId);
          }
        } catch {}
        dispatchPointerEvent('leave', e);
      },
      { signal }
    );

    // Touch event handling: single-finger gestures drive simulation forces without triggering browser pull-to-refresh
    this.canvasContainer.addEventListener(
      'touchstart',
      (e: TouchEvent) => {
        if (e.touches.length === 1) {
          e.preventDefault();
        }
      },
      { passive: false, signal }
    );

    this.canvasContainer.addEventListener(
      'touchmove',
      (e: TouchEvent) => {
        if (e.touches.length === 1) {
          e.preventDefault();
        }
      },
      { passive: false, signal }
    );
  }

  /**
   * Displays the loading overlay while compiling shaders and loading modules.
   */
  private showLoadingOverlay(metadata: RoomMetadata): void {
    if (!this.container) return;

    const overlay = document.createElement('div');
    overlay.className = 'room-loading-overlay';
    overlay.innerHTML = `
      <div class="room-loading-content">
        <div class="room-loading-spinner-ring" aria-hidden="true"></div>
        <div class="room-loading-meta">
          <span class="room-loading-badge">${metadata.indexDisplay} // ${metadata.backendDisplay}</span>
          <h2 class="room-loading-title">${metadata.name}</h2>
          <span class="room-loading-status">Compiling mathematical kernels & shaders...</span>
        </div>
      </div>
    `;

    this.container.appendChild(overlay);
    this.loadingOverlay = overlay;
  }

  /**
   * Fades out and removes the loading overlay.
   */
  private hideLoadingOverlay(): void {
    if (!this.loadingOverlay) return;

    this.loadingOverlay.classList.add('hidden');
    setTimeout(() => {
      if (this.loadingOverlay && this.loadingOverlay.parentNode) {
        this.loadingOverlay.parentNode.removeChild(this.loadingOverlay);
        this.loadingOverlay = null;
      }
    }, 320);
  }

  /**
   * Renders the archival error recovery placard when mounting fails.
   */
  private showErrorOverlay(errorMessage: string): void {
    if (!this.container) return;

    if (this.loadingOverlay) {
      this.loadingOverlay.remove();
      this.loadingOverlay = null;
    }

    const overlay = document.createElement('div');
    overlay.className = 'room-error-overlay';
    overlay.setAttribute('role', 'alert');

    overlay.innerHTML = `
      <div class="room-error-card">
        <div class="room-error-header">
          <span class="room-error-badge">Simulation Error</span>
          <h3 class="room-error-title">Mount Lifecycle Interrupted</h3>
        </div>
        <p class="room-error-message">${errorMessage || 'An unexpected graphics error occurred while initializing the room.'}</p>
        <div class="room-error-actions">
          <button type="button" class="room-btn-secondary" id="room-err-btn-gallery">
            Return to Gallery
          </button>
          <button type="button" class="room-btn-primary" id="room-err-btn-retry">
            Retry Simulation
          </button>
        </div>
      </div>
    `;

    this.container.appendChild(overlay);
    this.errorOverlay = overlay;

    const retryBtn = overlay.querySelector('#room-err-btn-retry');
    const galleryBtn = overlay.querySelector('#room-err-btn-gallery');

    retryBtn?.addEventListener('click', () => {
      if (this.activeRoomId && this.container?.parentElement) {
        const app = this.container.parentElement;
        const currentRoute = router.getCurrentRoute();
        const roomId = this.activeRoomId;
        this.destroy();
        this.mount(app, roomId, currentRoute);
      }
    }, { signal: this.abortController?.signal });

    galleryBtn?.addEventListener('click', () => {
      router.navigateToGallery();
    }, { signal: this.abortController?.signal });
  }
}
