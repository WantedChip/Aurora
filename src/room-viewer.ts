/**
 * Aurora Room Viewer & Fullscreen Viewport Controller
 * Direction: Obsidian Archival Minimal
 * 
 * Manages the full-screen canvas lifecycle, top navigation HUD bar,
 * Tweakpane parameter dock & mobile bottom drawer, discrete accessibility steppers,
 * deterministic seed randomization with smooth parameter damping,
 * parameter reset, URL state sharing, fullscreen toggling,
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

    if (this.lerpAnimFrameId) {
      cancelAnimationFrame(this.lerpAnimFrameId);
      this.lerpAnimFrameId = 0;
    }

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
          <button type="button" id="room-hud-btn-seed" class="room-hud-seed-btn" aria-label="Randomize Seed & Parameters" title="Randomize Seed (R)">
            <span aria-hidden="true">🎲</span> <span class="seed-value">${this.activeParams.seed}</span>
          </button>

          <button type="button" id="room-hud-btn-reset" class="room-hud-action-btn" aria-label="Reset Parameters to Default" title="Reset Defaults">
            <span aria-hidden="true" class="icon">↺</span> <span>Reset</span>
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

            folder.element.appendChild(stepperContainer);
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

    const openDrawer = () => {
      this.isMobileDrawerOpen = true;
      this.mobileDrawer?.classList.add('open');
      this.mobileScrim?.classList.add('open');
      this.wakeHUD();
    };

    const closeDrawer = () => {
      this.isMobileDrawerOpen = false;
      this.mobileDrawer?.classList.remove('open');
      this.mobileScrim?.classList.remove('open');
      this.wakeHUD();
    };

    this.mobileToggleBtn?.addEventListener('click', openDrawer, { signal });
    this.mobileScrim?.addEventListener('click', closeDrawer, { signal });

    const closeBtn = this.mobileDrawer?.querySelector('#room-drawer-btn-close');
    closeBtn?.addEventListener('click', closeDrawer, { signal });

    const drawerHeader = this.mobileDrawer?.querySelector('#room-drawer-header');
    drawerHeader?.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('#room-drawer-btn-close')) return;
      closeDrawer();
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
      if (this.isDestroyed || this.isHUDHidden || this.isInteractingWithControls || this.isMobileDrawerOpen) {
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
   * - S: Quick Snapshot
   * - L: Loop Record Trigger
   * - C: Copy Share Link
   * - F: Toggle Fullscreen
   * - Esc: Return to Gallery
   * - H: Toggle HUD Visibility
   */
  private setupKeyboardShortcuts(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (this.isDestroyed) return;

      // Ignore when focused inside an input/textarea/select
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
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        this.showToast('Snapshot Pipeline Ready');
      } else if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        this.showToast('Loop Recorder Pipeline Ready');
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
        if (this.isMobileDrawerOpen) {
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
    const isComputeHeavy = metadata.backend === 'webgpu-compute' || metadata.backend === 'tsl-shader';
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

      if (target && this.pane && this.pane.element.parentElement !== target) {
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
        dispatchPointerEvent('leave', e);
      },
      { signal }
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
