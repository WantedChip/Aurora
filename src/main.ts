/**
 * Aurora Application Entrypoint & Mounting Orchestrator
 * Direction: Obsidian Archival Minimal
 */

import './styles/main.css';
import './styles/gallery.css';
import './styles/room.css';
import './styles/tweakpane-theme.css';

import { router, type RouteState } from './lib/router';
import { GalleryView } from './gallery';
import { RoomViewer } from './room-viewer';

// Active view instances
let currentGalleryView: GalleryView | null = null;
let currentRoomViewer: RoomViewer | null = null;

/**
 * Mounts the main gallery landing page view.
 */
async function mountGalleryView(app: HTMLElement): Promise<void> {
  teardownActiveViews(app);

  currentGalleryView = new GalleryView();
  await currentGalleryView.mount(app);
}

/**
 * Mounts an individual room viewport using the unified RoomViewer controller.
 */
async function mountRoomView(app: HTMLElement, roomId: string, route: RouteState): Promise<void> {
  teardownActiveViews(app);

  currentRoomViewer = new RoomViewer();
  await currentRoomViewer.mount(app, roomId, route);
}

/**
 * Tears down any currently active view, room render loops, GPU contexts, or timers.
 */
function teardownActiveViews(app: HTMLElement): void {
  if (currentRoomViewer) {
    try {
      currentRoomViewer.destroy();
    } catch (err) {
      console.warn('Error during room viewer disposal:', err);
    }
    currentRoomViewer = null;
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

// Expose verification runner on window for automated and developer verification
if (typeof window !== 'undefined') {
  (window as any).runLibVerification = async () => {
    const { runLibVerification } = await import('./verify-lib');
    return runLibVerification();
  };
}

// Start application on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}

