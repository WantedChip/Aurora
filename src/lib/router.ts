/**
 * Aurora Client-Side Hash Router
 * 
 * Provides frictionless, zero-backend routing between the gallery catalog
 * and individual generative exhibit rooms with full URL search parameter synchronization.
 */

import { parseHash, serializeHash, type ParsedRouteState } from './state';

export interface RouteState extends ParsedRouteState {
  path: string;
  hash: string;
}

export type RouteHandler = (to: RouteState, from: RouteState | null) => Promise<void> | void;
export type RouteMiddleware = (to: RouteState, from: RouteState | null) => boolean | Promise<boolean>;

export class Router {
  private listeners = new Set<RouteHandler>();
  private middlewares: RouteMiddleware[] = [];
  private currentRoute: RouteState | null = null;
  private isListening = false;
  private isTransitioning = false;

  constructor() {
    this.handleHashChange = this.handleHashChange.bind(this);
  }

  /**
   * Parses the current browser window location into a structured RouteState.
   */
  public getCurrentRoute(): RouteState {
    const rawHash = (typeof window !== 'undefined' ? window.location.hash : '') || '#/';
    const parsed = parseHash(rawHash);
    const path = parsed.roomId ? `/${parsed.roomId}` : '/';

    return {
      ...parsed,
      path,
      hash: rawHash,
    };
  }

  /**
   * Registers a callback listener invoked whenever the route changes.
   * Returns an unsubscribe function.
   */
  public onRouteChange(handler: RouteHandler): () => void {
    this.listeners.add(handler);
    return () => {
      this.listeners.delete(handler);
    };
  }

  /**
   * Registers a guard middleware executed before route transitions.
   * Return false to cancel the navigation.
   */
  public beforeEach(middleware: RouteMiddleware): () => void {
    this.middlewares.push(middleware);
    return () => {
      const idx = this.middlewares.indexOf(middleware);
      if (idx >= 0) this.middlewares.splice(idx, 1);
    };
  }

  /**
   * Programmatically navigates to a new hash route.
   */
  public navigate(hashOrPath: string, replace = false): void {
    if (typeof window === 'undefined') return;

    let targetHash = hashOrPath.trim();
    if (!targetHash.startsWith('#')) {
      targetHash = targetHash.startsWith('/') ? `#${targetHash}` : `#/${targetHash}`;
    }

    if (window.location.hash === targetHash) {
      // Re-trigger current route handler if navigating to the same hash
      this.handleHashChange();
      return;
    }

    if (replace && window.history && window.history.replaceState) {
      const newUrl = window.location.pathname + window.location.search + targetHash;
      window.history.replaceState(null, '', newUrl);
      this.handleHashChange();
    } else {
      window.location.hash = targetHash;
    }
  }

  /**
   * Navigates directly into an exhibit room with optional parameter overrides.
   */
  public navigateToRoom(
    roomId: string,
    params?: Record<string, any>,
    defaultParams?: Record<string, any>,
    replace = false
  ): void {
    const targetHash = serializeHash(roomId, params, defaultParams);
    this.navigate(targetHash, replace);
  }

  /**
   * Navigates back to the main gallery catalog view.
   */
  public navigateToGallery(replace = false): void {
    this.navigate('#/', replace);
  }

  /**
   * Starts listening to browser hashchange events and dispatches the initial route.
   */
  public start(): void {
    if (this.isListening || typeof window === 'undefined') return;

    window.addEventListener('hashchange', this.handleHashChange);
    this.isListening = true;

    // Handle initial route on startup
    this.handleHashChange();
  }

  /**
   * Detaches event listeners.
   */
  public stop(): void {
    if (!this.isListening || typeof window === 'undefined') return;

    window.removeEventListener('hashchange', this.handleHashChange);
    this.isListening = false;
  }

  /**
   * Internal hash change event handler.
   */
  private async handleHashChange(): Promise<void> {
    if (this.isTransitioning) return;

    const toRoute = this.getCurrentRoute();
    const fromRoute = this.currentRoute;

    // Execute middlewares
    for (const middleware of this.middlewares) {
      try {
        const allowed = await middleware(toRoute, fromRoute);
        if (!allowed) {
          return;
        }
      } catch (err) {
        console.error('Route middleware error:', err);
        return;
      }
    }

    this.isTransitioning = true;
    this.currentRoute = toRoute;

    try {
      // Execute all registered listeners
      for (const listener of this.listeners) {
        await listener(toRoute, fromRoute);
      }
    } catch (err) {
      console.error('Error during route transition:', err);
    } finally {
      this.isTransitioning = false;
    }
  }
}

// Global router singleton
export const router = new Router();
