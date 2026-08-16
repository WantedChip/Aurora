/**
 * Aurora Room Viewer & Fullscreen Viewport Controller
 * Direction: Obsidian Archival Minimal
 * 
 * Manages the full-screen canvas lifecycle, dynamic room module loading,
 * GPU hardware capability inspection, responsive canvas resize handling,
 * pointer interactions, and clean context teardown.
 */

import type { RouteState } from './lib/router';
import { router } from './lib/router';
import { getRoomById, lazyLoadRoom } from './rooms/registry';
import type {
  RoomMetadata,
  RoomInstance,
  RoomCleanupFn,
  RoomPointerEvent,
  RoomContext,
} from './rooms/types';
import { createPRNG, type PRNG } from './lib/prng';
import { detectGPUCapabilities, getClampedDPR, type GPUCapabilities } from './lib/gpu';
import { parseParams } from './lib/state';

export class RoomViewer {
  private container: HTMLElement | null = null;
  private canvasContainer: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private loadingOverlay: HTMLElement | null = null;
  private gpuBanner: HTMLElement | null = null;
  private errorOverlay: HTMLElement | null = null;
  private hudBar: HTMLElement | null = null;

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
  private isPointerDown = false;
  private isMounted = false;
  private isDestroyed = false;

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

    // Render viewport DOM scaffolding
    this.renderDOM(app);
    this.showLoadingOverlay(metadata);

    // Perform hardware capability check and mount room
    try {
      this.gpuCapabilities = await detectGPUCapabilities();
      if (this.isDestroyed) return;

      this.checkHardwareCapabilities(metadata, this.gpuCapabilities);
      this.setupResizeHandling();
      this.setupPointerListeners();

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

    if (this.resizeDebounceTimer !== null) {
      clearTimeout(this.resizeDebounceTimer);
      this.resizeDebounceTimer = null;
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

    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.canvas = null;
    this.canvasContainer = null;
    this.hudBar = null;
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
    if (this.currentRoomInstance && typeof this.currentRoomInstance.updateParams === 'function') {
      this.currentRoomInstance.updateParams(this.activeParams);
    }
  }

  /**
   * Renders the basic room DOM scaffolding.
   */
  private renderDOM(app: HTMLElement): void {
    const container = document.createElement('div');
    container.className = 'room-viewport-container';
    container.id = 'room-viewport';

    const canvasContainer = document.createElement('div');
    canvasContainer.className = 'room-canvas-container';

    const canvas = document.createElement('canvas');
    canvas.className = 'room-canvas';
    canvas.setAttribute('aria-label', `Interactive simulation of ${this.activeMetadata?.name || 'generative artwork'}`);
    canvas.setAttribute('tabindex', '0');

    canvasContainer.appendChild(canvas);
    container.appendChild(canvasContainer);

    // Initial Top HUD Navigation Bar
    const hudBar = document.createElement('header');
    hudBar.className = 'room-hud-bar';
    hudBar.setAttribute('role', 'toolbar');
    hudBar.setAttribute('aria-label', 'Exhibit Navigation & Controls');

    const meta = this.activeMetadata!;
    hudBar.innerHTML = `
      <div class="room-hud-left">
        <button type="button" id="room-hud-btn-back" class="room-hud-back" aria-label="Return to Gallery">
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
        <span class="room-hud-badge" title="Rendering Backend">${meta.backendDisplay}</span>
        <span class="room-hud-seed-chip" title="Active PRNG Seed">
          <span style="opacity: 0.6;">SEED:</span> ${this.activeParams.seed}
        </span>
      </div>
    `;

    container.appendChild(hudBar);
    app.appendChild(container);

    this.container = container;
    this.canvasContainer = canvasContainer;
    this.canvas = canvas;
    this.hudBar = hudBar;

    // Attach back button listener
    const backBtn = hudBar.querySelector('#room-hud-btn-back');
    backBtn?.addEventListener('click', () => {
      router.navigateToGallery();
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
   * Handles canvas dimension updates with debouncing.
   */
  private handleResize(): void {
    if (this.isDestroyed || !this.canvas || !this.canvasContainer) return;

    if (this.resizeDebounceTimer !== null) {
      clearTimeout(this.resizeDebounceTimer);
    }

    this.resizeDebounceTimer = window.setTimeout(() => {
      this.resizeCanvasBuffer();
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
