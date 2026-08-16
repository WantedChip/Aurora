/**
 * Aurora Application Entrypoint & Mounting Orchestrator
 * Direction: Obsidian Archival Minimal
 */

import './styles/main.css';
import './styles/gallery.css';

import { router, type RouteState } from './lib/router';
import { GalleryView } from './gallery';
import { getRoomById, lazyLoadRoom } from './rooms/registry';
import { createPRNG } from './lib/prng';
import { getClampedDPR } from './lib/gpu';
import type { RoomCleanupFn } from './rooms/types';

// Active view instances and cleanup references
let currentGalleryView: GalleryView | null = null;
let currentRoomCleanup: RoomCleanupFn | null = null;

/**
 * Mounts the main gallery landing page view.
 */
async function mountGalleryView(app: HTMLElement): Promise<void> {
  teardownActiveViews(app);

  currentGalleryView = new GalleryView();
  await currentGalleryView.mount(app);
}

/**
 * Mounts an individual room viewport (fallback/early container until Phase v0.3).
 */
async function mountRoomView(app: HTMLElement, roomId: string, route: RouteState): Promise<void> {
  teardownActiveViews(app);

  const metadata = getRoomById(roomId);
  if (!metadata) {
    console.warn(`Room "${roomId}" not found in catalog. Redirecting to gallery.`);
    router.navigateToGallery(true);
    return;
  }

  // Create room viewport container
  const roomWrapper = document.createElement('div');
  roomWrapper.className = 'room-viewport-wrapper';
  roomWrapper.style.cssText = `
    position: relative;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    background: var(--bg-void);
    display: flex;
    flex-direction: column;
  `;

  // Temporary In-Room Top HUD Bar (Phase v0.3 will build complete HUD & dock)
  const hudBar = document.createElement('div');
  hudBar.className = 'room-temp-hud';
  hudBar.style.cssText = `
    position: absolute;
    top: 16px;
    left: 16px;
    right: 16px;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-2) var(--space-4);
    background: rgba(17, 20, 28, 0.88);
    backdrop-filter: var(--backdrop-blur-hud);
    border: 1px solid var(--border-subtle-2);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-dock);
  `;

  hudBar.innerHTML = `
    <div style="display: flex; align-items: center; gap: var(--space-3);">
      <button type="button" id="room-btn-back" class="nav-btn" style="height: 32px; font-weight: 600;">
        ← Gallery
      </button>
      <div style="width: 1px; height: 16px; background: var(--border-subtle);"></div>
      <div style="display: flex; align-items: center; gap: var(--space-2);">
        <span style="font-family: var(--font-mono); font-size: var(--text-mono-badge); color: var(--accent-cyan); font-weight: 600;">${metadata.indexDisplay}</span>
        <span style="font-family: var(--font-display); font-weight: 700; font-size: var(--text-body-lg); color: var(--text-primary);">${metadata.name}</span>
      </div>
    </div>

    <div style="display: flex; align-items: center; gap: var(--space-3);">
      <div style="font-family: var(--font-mono); font-size: var(--text-mono-badge); color: var(--text-muted); background: var(--bg-surface-2); padding: 2px 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
        ${metadata.backendDisplay}
      </div>
      <div style="font-family: var(--font-mono); font-size: var(--text-mono-badge); color: var(--accent-mint); background: rgba(0, 255, 157, 0.1); padding: 2px 8px; border-radius: var(--radius-sm); border: 1px solid rgba(0, 255, 157, 0.25);">
        SEED: ${route.params?.seed || metadata.defaultParams.seed}
      </div>
    </div>
  `;

  const canvas = document.createElement('canvas');
  canvas.style.cssText = `
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
  `;

  roomWrapper.appendChild(canvas);
  roomWrapper.appendChild(hudBar);
  app.appendChild(roomWrapper);

  // Hook back button
  const backBtn = hudBar.querySelector('#room-btn-back');
  backBtn?.addEventListener('click', () => {
    router.navigateToGallery();
  });

  // Mount room simulation instance
  try {
    const roomInstance = await lazyLoadRoom(roomId);
    const params = { ...metadata.defaultParams, ...route.params, seed: route.params?.seed || metadata.defaultParams.seed };
    const prng = createPRNG(params.seed);
    const dpr = getClampedDPR(2.0);

    const cleanup = await roomInstance.mount({
      canvas,
      container: roomWrapper,
      params,
      prng,
      dpr,
    });

    currentRoomCleanup = typeof cleanup === 'function' ? cleanup : null;
  } catch (err) {
    console.error(`Failed to mount room "${roomId}":`, err);
  }
}

/**
 * Tears down any currently active view, room render loops, or timers.
 */
function teardownActiveViews(app: HTMLElement): void {
  if (currentRoomCleanup) {
    try {
      currentRoomCleanup();
    } catch (err) {
      console.warn('Error during room cleanup disposal:', err);
    }
    currentRoomCleanup = null;
  }

  if (currentGalleryView) {
    try {
      currentGalleryView.destroy();
    } catch (err) {
      console.warn('Error during gallery view disposal:', err);
    }
    currentGalleryView = null;
  }

  app.innerHTML = '';
}

/**
 * Handles route transitions dispatched from the hash router.
 */
async function handleRoute(to: RouteState): Promise<void> {
  const app = document.getElementById('app');
  if (!app) return;

  if (to.roomId) {
    await mountRoomView(app, to.roomId, to);
  } else {
    await mountGalleryView(app);
  }
}

/**
 * Application Bootstrap
 */
function bootstrap(): void {
  router.onRouteChange(handleRoute);
  router.start();
}

// Start application on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
