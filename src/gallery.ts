/**
 * Aurora Gallery View & Archival Shell Orchestrator
 * Direction: Obsidian Archival Minimal
 */

import Lenis from 'lenis';
import {
  ROOM_CATALOG,
  getCategories,
  searchRooms,
} from './rooms/registry';
import type { RoomCategory, RoomMetadata } from './rooms/types';
import { generateRandomSeed } from './lib/prng';
import { detectGPUCapabilities, formatGPUTelemetryBadge } from './lib/gpu';
import { router } from './lib/router';
import { HeroSimulation } from './lib/hero-sim';
import { MiniPreviewManager } from './lib/mini-previews';

export class GalleryView {
  private container: HTMLElement | null = null;
  private lenis: Lenis | null = null;
  private heroSim: HeroSimulation | null = null;
  private miniPreviewManager: MiniPreviewManager | null = null;
  private abortController: AbortController | null = null;

  private activeCategory: RoomCategory | 'all' = 'all';
  private searchQuery = '';
  private layoutMode: 'grid' | 'list' = 'grid';
  private filteredRooms: RoomMetadata[] = [...ROOM_CATALOG];
  private isModalOpen = false;
  private previousActiveElement: HTMLElement | null = null;
  private searchDebounceTimer: number | null = null;

  /**
   * Assembles and mounts the complete landing page gallery shell into the specified DOM element.
   */
  public async mount(container: HTMLElement): Promise<void> {
    this.container = container;
    this.abortController = new AbortController();
    this.miniPreviewManager = new MiniPreviewManager();

    this.renderDOM();
    this.setupLenis();
    this.setupHeroSimulation();
    this.setupToolbar();
    this.renderExhibits();
    this.setupEventListeners();
    this.updateTelemetry();
  }

  /**
   * Tears down the gallery view, cleans up Lenis, simulation loops, and removes DOM event listeners.
   */
  public destroy(): void {
    if (this.searchDebounceTimer !== null) {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = null;
    }

    if (this.miniPreviewManager) {
      this.miniPreviewManager.destroy();
      this.miniPreviewManager = null;
    }

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    if (this.heroSim) {
      this.heroSim.destroy();
      this.heroSim = null;
    }

    if (this.lenis) {
      this.lenis.destroy();
      this.lenis = null;
    }

    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }

  /**
   * Sets the active curatorial category and filters the exhibit catalog.
   */
  public setCategory(category: RoomCategory | 'all'): void {
    if (this.activeCategory === category) return;
    this.activeCategory = category;

    // Update active state in pills UI
    const pills = document.querySelectorAll<HTMLButtonElement>('.filter-pill');
    pills.forEach(pill => {
      const isSelected = pill.dataset.category === category;
      pill.classList.toggle('active', isSelected);
      pill.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    });

    this.filterAndRender();
  }

  /**
   * Updates the search query and filters the exhibit catalog.
   */
  public setSearchQuery(query: string): void {
    this.searchQuery = query.trim();
    this.filterAndRender();
  }

  /**
   * Switches between visual card grid and dense archival list layouts.
   */
  public setLayoutMode(mode: 'grid' | 'list'): void {
    if (this.layoutMode === mode) return;
    this.layoutMode = mode;

    const gridBtn = document.getElementById('layout-btn-grid');
    const listBtn = document.getElementById('layout-btn-list');

    if (gridBtn && listBtn) {
      gridBtn.classList.toggle('active', mode === 'grid');
      gridBtn.setAttribute('aria-pressed', mode === 'grid' ? 'true' : 'false');
      listBtn.classList.toggle('active', mode === 'list');
      listBtn.setAttribute('aria-pressed', mode === 'list' ? 'true' : 'false');
    }

    this.renderExhibits();
  }

  /**
   * Resets all search filters and category selections.
   */
  public resetFilters(): void {
    this.activeCategory = 'all';
    this.searchQuery = '';

    const searchInput = document.getElementById('gallery-search-input') as HTMLInputElement | null;
    if (searchInput) {
      searchInput.value = '';
    }

    const clearBtn = document.getElementById('search-clear-btn');
    if (clearBtn) {
      clearBtn.style.display = 'none';
    }

    const pills = document.querySelectorAll<HTMLButtonElement>('.filter-pill');
    pills.forEach(pill => {
      const isAll = pill.dataset.category === 'all';
      pill.classList.toggle('active', isAll);
      pill.setAttribute('aria-selected', isAll ? 'true' : 'false');
    });

    this.filterAndRender();
  }

  /**
   * Opens the curatorial About / Info modal dialog.
   */
  public openAboutModal(triggerEl?: HTMLElement | null): void {
    const modal = document.getElementById('about-modal');
    if (!modal) return;

    this.previousActiveElement = triggerEl || (document.activeElement as HTMLElement | null);
    this.isModalOpen = true;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');

    if (this.lenis) {
      this.lenis.stop();
    }

    const closeBtn = modal.querySelector<HTMLButtonElement>('#modal-close-btn');
    closeBtn?.focus();
  }

  /**
   * Closes the curatorial About / Info modal dialog.
   */
  public closeAboutModal(): void {
    const modal = document.getElementById('about-modal');
    if (!modal) return;

    this.isModalOpen = false;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');

    if (this.lenis) {
      this.lenis.start();
    }

    if (this.previousActiveElement && typeof this.previousActiveElement.focus === 'function') {
      this.previousActiveElement.focus();
      this.previousActiveElement = null;
    }
  }

  /**
   * Toggles the modal dialog state.
   */
  public toggleAboutModal(): void {
    if (this.isModalOpen) {
      this.closeAboutModal();
    } else {
      this.openAboutModal();
    }
  }

  /**
   * Performs real-time fuzzy filtering and updates DOM.
   */
  private filterAndRender(): void {
    this.filteredRooms = searchRooms(this.searchQuery, this.activeCategory);

    // Update result count readout
    const countNum = document.getElementById('results-count-num');
    if (countNum) {
      countNum.textContent = String(this.filteredRooms.length);
    }

    this.renderExhibits();
  }

  /**
   * Initializes the Lenis smooth momentum scroll engine.
   */
  private setupLenis(): void {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.lenis = new Lenis({
      autoRaf: true,
      smoothWheel: !prefersReducedMotion,
      respectReducedMotion: true,
      duration: 1.2,
      easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    });
  }

  /**
   * Initializes the ambient hero curl-noise simulation canvas.
   */
  private setupHeroSimulation(): void {
    const canvas = document.getElementById('hero-ambient-canvas') as HTMLCanvasElement | null;
    const heroSection = document.getElementById('hero-section');
    if (!canvas || !heroSection) return;

    this.heroSim = new HeroSimulation();
    this.heroSim.mount(canvas, heroSection);
  }

  /**
   * Renders the complete HTML structure of the gallery shell.
   */
  private renderDOM(): void {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="gallery-shell">
        <!-- Skip to Content Navigation Link for Accessibility -->
        <a href="#gallery-section" class="skip-link">Skip to exhibition chambers</a>

        <!-- Sticky Navigation Header -->
        <header class="gallery-header" role="banner">
          <a href="#/" class="header-brand" aria-label="Aurora Observatory Home">
            <div class="brand-logo-wrap">
              <span class="brand-symbol">✦</span>
              <span class="brand-title">AURORA</span>
            </div>
            <div class="brand-divider"></div>
            <span class="brand-tagline">OBSERVATORY</span>
          </a>

          <div class="header-actions">
            <div class="badge-room-count">
              <span class="pulse-dot"></span>
              <span>${ROOM_CATALOG.length} Exhibits</span>
            </div>

            <button type="button" class="nav-btn nav-btn-icon-only" id="header-btn-shortcuts" title="Keyboard Shortcuts (?)" aria-label="Keyboard Shortcuts">
              <span>?</span>
            </button>

            <button type="button" class="nav-btn nav-btn-info" id="header-btn-about" aria-label="About &amp; Architecture">
              <span>✦</span>
              <span>About</span>
            </button>

            <a href="https://github.com/WantedChip/Aurora" target="_blank" rel="noopener noreferrer" class="nav-btn" aria-label="GitHub Repository">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
              </svg>
              <span>GitHub</span>
            </a>
          </div>
        </header>

        <!-- Hero Section: Ambient Simulation & Masthead -->
        <section class="hero-section" id="hero-section" aria-label="Introduction">
          <div class="hero-canvas-container">
            <canvas id="hero-ambient-canvas" class="hero-ambient-canvas"></canvas>
            <div class="hero-gradient-overlay"></div>
          </div>

          <div class="hero-content">
            <div class="hero-placard-meta">
              <span class="meta-star">✦</span>
              <span>ROOM 00 // COMPUTATIONAL OBSERVATORY</span>
            </div>

            <h1 class="hero-title">AURORA</h1>
            <h2 class="hero-subtitle">Real-Time Generative Systems &amp; WebGPU Compute Gallery</h2>

            <p class="hero-description">
              Explore 16 deterministic algorithmic chambers powered by Three.js TSL shaders,
              WebGPU compute agent systems, and Navier-Stokes mathematical dynamics.
              Zero backend, pure static client execution.
            </p>

            <div class="hero-actions">
              <button type="button" class="hero-btn-primary" id="hero-btn-explore">
                <span>⚡ Explore Exhibits ↓</span>
              </button>

              <button type="button" class="hero-btn-secondary" id="hero-btn-random">
                <span>🎲 Random Room &amp; Seed</span>
              </button>
            </div>

            <div class="hero-telemetry-ribbon" id="hero-telemetry-ribbon">
              <div class="telemetry-chip mint" id="telemetry-gpu-chip">
                <span class="telemetry-dot"></span>
                <span id="telemetry-gpu-text">INSPECTING GPU...</span>
              </div>
              <div class="telemetry-chip">
                <span class="telemetry-dot"></span>
                <span>16 ROOMS REGISTERED</span>
              </div>
              <div class="telemetry-chip">
                <span class="telemetry-dot"></span>
                <span>ZERO BACKEND</span>
              </div>
              <div class="telemetry-chip">
                <span class="telemetry-dot"></span>
                <span>URL HASH DETERMINISTIC</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Main Gallery Exhibition Section -->
        <main class="gallery-section" id="gallery-section">
          <div class="gallery-section-header">
            <span class="section-label">EXHIBIT CATALOG</span>
            <h2 class="section-title">Algorithmic Exhibition Chambers</h2>
            <p class="section-desc">
              Select an exhibit to enter full-screen interactive simulation mode with real-time parameter docks,
              lossless 8K snapshot export, and seamless 60 FPS video loop recording.
            </p>
          </div>

          <!-- Dynamic Filter & Search Toolbar Mount -->
          <div id="gallery-toolbar" class="gallery-toolbar-mount"></div>

          <!-- Dynamic Exhibit Grid Mount -->
          <div id="exhibit-grid" class="exhibit-grid-mount"></div>
        </main>

        <!-- Exhibition Colophon & Footer -->
        <footer class="gallery-footer" role="contentinfo">
          <div class="footer-container">
            <div class="footer-top-grid">
              <!-- Col 1: Colophon -->
              <div class="footer-col">
                <div class="footer-brand">
                  <span style="color: var(--accent-cyan);">✦</span>
                  <span>AURORA</span>
                </div>
                <p class="footer-desc">
                  An open-source digital museum and research observatory dedicated to real-time generative computing,
                  continuous cellular automata, mathematical chaos, and WebGPU compute shaders.
                </p>
              </div>

              <!-- Col 2: Algorithmic Categories -->
              <div class="footer-col">
                <span class="footer-col-title">Exhibition Disciplines</span>
                <ul class="footer-links">
                  <li class="footer-link footer-cat-link" data-cat="field-flow">Field &amp; Flow Dynamics</li>
                  <li class="footer-link footer-cat-link" data-cat="art-life">Artificial Life &amp; Turing</li>
                  <li class="footer-link footer-cat-link" data-cat="chaos">Mathematical Chaos &amp; Fractals</li>
                  <li class="footer-link footer-cat-link" data-cat="fluid">Navier-Stokes &amp; Isosurfaces</li>
                  <li class="footer-link footer-cat-link" data-cat="cosmic">Cosmic Density Waves</li>
                  <li class="footer-link footer-cat-link" data-cat="audio">Audio-Reactive Optics</li>
                </ul>
              </div>

              <!-- Col 3: Engine Architecture -->
              <div class="footer-col">
                <span class="footer-col-title">Technical Architecture</span>
                <ul class="footer-links">
                  <li class="footer-link">Three.js r173 WebGPU</li>
                  <li class="footer-link">TSL Shading Language</li>
                  <li class="footer-link">WGSL Compute Storage Buffers</li>
                  <li class="footer-link">Mulberry32 PRNG Engine</li>
                  <li class="footer-link">Web Audio API Synthesis</li>
                  <li class="footer-link">Cloudflare Workers Static Assets</li>
                </ul>
              </div>

              <!-- Col 4: Curatorial Actions -->
              <div class="footer-col">
                <span class="footer-col-title">Observatory Actions</span>
                <ul class="footer-links">
                  <li class="footer-link" id="footer-link-explore">Explore 16 Exhibits</li>
                  <li class="footer-link" id="footer-link-random">Random Simulation</li>
                  <li class="footer-link" id="footer-link-about">Curatorial Statement &amp; Specs</li>
                  <li>
                    <a href="https://github.com/WantedChip/Aurora" target="_blank" rel="noopener noreferrer" class="footer-link" style="display: inline-flex; align-items: center; gap: 4px;">
                      <span>Source Code (GitHub)</span>
                      <span>↗</span>
                    </a>
                  </li>
                </ul>
              </div>
            </div>

            <!-- Bottom Row -->
            <div class="footer-bottom-row">
              <div class="footer-copyright">
                MIT License © 2026 WantedChip • Client-Side Static App • Obsidian Archival Minimal
              </div>

              <div class="footer-actions">
                <button type="button" class="btn-back-to-top" id="footer-btn-top">
                  <span>Back to Top</span>
                  <span>↑</span>
                </button>
              </div>
            </div>
          </div>
        </footer>

        <!-- Curatorial About / Info Modal Dialog -->
        <div class="modal-backdrop" id="about-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title-text" aria-hidden="true">
          <div class="modal-panel" role="document">
            <div class="modal-header">
              <div class="modal-header-left">
                <span class="modal-placard-tag">CURATORIAL COLOPHON // SPECIFICATION</span>
                <h3 class="modal-title" id="modal-title-text">✦ AURORA OBSERVATORY</h3>
              </div>

              <button type="button" class="modal-close-btn" id="modal-close-btn" aria-label="Close dialog">
                ✕
              </button>
            </div>

            <div class="modal-body">
              <div class="modal-section">
                <h4 class="modal-section-title">Exhibition Philosophy</h4>
                <p>
                  Aurora is designed around the concept of the <strong>"Black Cube" Museum &amp; Creative Computing Observatory</strong>.
                  In physical contemporary institutions (such as the Tate Modern Tanks or ZKM Center for Art and Media),
                  light-based generative media is showcased in pitch-dark architectural volumes so that kinetic color and
                  algorithmic complexity emanate purely from the artwork itself.
                </p>
              </div>

              <div class="modal-section">
                <h4 class="modal-section-title">Hardware &amp; Computational Engine</h4>
                <p>
                  Every exhibit is executed in real-time on the client GPU with zero server-side rendering or database latency.
                </p>
                <div class="tech-spec-grid">
                  <div class="tech-spec-card">
                    <span class="tech-spec-label">Renderer</span>
                    <span class="tech-spec-val">Three.js r173 WebGPURenderer</span>
                  </div>
                  <div class="tech-spec-card">
                    <span class="tech-spec-label">Shading Engine</span>
                    <span class="tech-spec-val">Three Shading Language (TSL)</span>
                  </div>
                  <div class="tech-spec-card">
                    <span class="tech-spec-label">Agent Compute</span>
                    <span class="tech-spec-val">WGSL Compute Storage Buffers</span>
                  </div>
                  <div class="tech-spec-card">
                    <span class="tech-spec-label">Determinism</span>
                    <span class="tech-spec-val">Mulberry32 PRNG (URL Hash Sync)</span>
                  </div>
                  <div class="tech-spec-card">
                    <span class="tech-spec-label">Audio System</span>
                    <span class="tech-spec-val">Web Audio API Analyser + Synth</span>
                  </div>
                  <div class="tech-spec-card">
                    <span class="tech-spec-label">Hosting Target</span>
                    <span class="tech-spec-val">Cloudflare Workers Static Assets</span>
                  </div>
                </div>
              </div>

              <div class="modal-section">
                <h4 class="modal-section-title">Global Keyboard Shortcuts</h4>
                <div class="shortcut-grid">
                  <div class="shortcut-row">
                    <span class="shortcut-desc">Randomize Seed</span>
                    <kbd class="shortcut-key">R</kbd>
                  </div>
                  <div class="shortcut-row">
                    <span class="shortcut-desc">Pause / Resume</span>
                    <kbd class="shortcut-key">Space</kbd>
                  </div>
                  <div class="shortcut-row">
                    <span class="shortcut-desc">Fullscreen</span>
                    <kbd class="shortcut-key">F</kbd>
                  </div>
                  <div class="shortcut-row">
                    <span class="shortcut-desc">Snapshot Export</span>
                    <kbd class="shortcut-key">S</kbd>
                  </div>
                  <div class="shortcut-row">
                    <span class="shortcut-desc">Video Loop Record</span>
                    <kbd class="shortcut-key">L</kbd>
                  </div>
                  <div class="shortcut-row">
                    <span class="shortcut-desc">Copy Share Link</span>
                    <kbd class="shortcut-key">C</kbd>
                  </div>
                  <div class="shortcut-row">
                    <span class="shortcut-desc">Toggle In-Room HUD</span>
                    <kbd class="shortcut-key">H</kbd>
                  </div>
                  <div class="shortcut-row">
                    <span class="shortcut-desc">About &amp; Info Dialog</span>
                    <kbd class="shortcut-key">?</kbd>
                  </div>
                  <div class="shortcut-row">
                    <span class="shortcut-desc">Focus Search Filter</span>
                    <kbd class="shortcut-key">/</kbd>
                  </div>
                  <div class="shortcut-row">
                    <span class="shortcut-desc">Close Modal / Back</span>
                    <kbd class="shortcut-key">Esc</kbd>
                  </div>
                </div>
              </div>

              <div class="modal-section">
                <h4 class="modal-section-title">Open Source Licensing &amp; Provenance</h4>
                <p>
                  Aurora is licensed under the <strong>MIT Open Source License</strong>.
                  All mathematical models, shader kernels, and algorithmic structures are libre for research, education, and creative exploration.
                </p>
              </div>
            </div>

            <div class="modal-footer">
              <span>Aurora v0.2.2 • Obsidian Archival Minimal</span>
              <span>Press <kbd style="color: var(--accent-cyan);">Esc</kbd> to close</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Assembles the category filter ribbon, search bar, and layout toggle into `#gallery-toolbar`.
   */
  private setupToolbar(): void {
    const toolbar = document.getElementById('gallery-toolbar');
    if (!toolbar) return;

    const categories = getCategories();

    toolbar.innerHTML = `
      <div class="gallery-toolbar">
        <!-- Category Filter Pills -->
        <div class="filter-pills-row" role="tablist" aria-label="Curatorial Categories">
          ${categories
            .map(
              cat => `
            <button
              type="button"
              id="filter-pill-${cat.id}"
              class="filter-pill ${this.activeCategory === cat.id ? 'active' : ''}"
              data-category="${cat.id}"
              role="tab"
              aria-selected="${this.activeCategory === cat.id ? 'true' : 'false'}"
              aria-controls="exhibit-grid"
              tabindex="${this.activeCategory === cat.id ? '0' : '-1'}"
            >
              ${cat.id !== 'all' ? `<span class="category-dot cat-${cat.id}"></span>` : ''}
              <span class="pill-name">${cat.name}</span>
              <span class="pill-count">${cat.count}</span>
            </button>
          `
            )
            .join('')}
        </div>

        <!-- Controls Row: Search Input & Layout Switcher -->
        <div class="toolbar-controls-row">
          <div class="search-input-wrapper">
            <span class="search-icon" aria-hidden="true">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </span>
            <input
              type="search"
              id="gallery-search-input"
              class="gallery-search-input"
              placeholder="Filter by algorithm, technique, or math... (Press '/' to search)"
              aria-label="Filter exhibits by title, algorithm, tech, or tags"
              aria-controls="exhibit-grid"
              autocomplete="off"
              spellcheck="false"
              value="${this.searchQuery}"
            />
            <button type="button" id="search-clear-btn" class="search-clear-btn" aria-label="Clear search" style="${
              this.searchQuery ? 'display: flex;' : 'display: none;'
            }">✕</button>
            <kbd class="search-shortcut-hint" aria-hidden="true">/</kbd>
          </div>

          <div class="toolbar-actions">
            <div class="results-badge" id="results-count-badge" role="status" aria-live="polite">
              <span>Showing <strong id="results-count-num">${this.filteredRooms.length}</strong> exhibits</span>
            </div>

            <div class="layout-toggle-group" role="group" aria-label="Layout view">
              <button
                type="button"
                class="layout-btn ${this.layoutMode === 'grid' ? 'active' : ''}"
                id="layout-btn-grid"
                data-layout="grid"
                title="Grid View"
                aria-label="Grid view"
                aria-pressed="${this.layoutMode === 'grid' ? 'true' : 'false'}"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="7" height="7"></rect>
                  <rect x="14" y="3" width="7" height="7"></rect>
                  <rect x="14" y="14" width="7" height="7"></rect>
                  <rect x="3" y="14" width="7" height="7"></rect>
                </svg>
                <span>Grid</span>
              </button>
              <button
                type="button"
                class="layout-btn ${this.layoutMode === 'list' ? 'active' : ''}"
                id="layout-btn-list"
                data-layout="list"
                title="List View"
                aria-label="List view"
                aria-pressed="${this.layoutMode === 'list' ? 'true' : 'false'}"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="8" y1="6" x2="21" y2="6"></line>
                  <line x1="8" y1="12" x2="21" y2="12"></line>
                  <line x1="8" y1="18" x2="21" y2="18"></line>
                  <line x1="3" y1="6" x2="3.01" y2="6"></line>
                  <line x1="3" y1="12" x2="3.01" y2="12"></line>
                  <line x1="3" y1="18" x2="3.01" y2="18"></line>
                </svg>
                <span>List</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Renders the filtered exhibits in either Grid or List mode into `#exhibit-grid`.
   */
  private renderExhibits(): void {
    const grid = document.getElementById('exhibit-grid');
    if (!grid) return;

    this.miniPreviewManager?.unregisterAll();

    if (this.filteredRooms.length === 0) {
      grid.innerHTML = `
        <div class="empty-results-placard">
          <div class="empty-icon-wrap">
            <span class="empty-symbol">✦</span>
          </div>
          <h3 class="empty-title">No Generative Systems Found</h3>
          <p class="empty-desc">
            No exhibits match the query <strong class="empty-query-term">"${this.searchQuery || this.activeCategory}"</strong>.
          </p>
          <div class="empty-suggestions">
            <span>Try searching for algorithms such as:</span>
            <div class="suggestion-chips">
              <button type="button" class="chip-btn" data-query="curl">curl noise</button>
              <button type="button" class="chip-btn" data-query="turing">turing</button>
              <button type="button" class="chip-btn" data-query="webgpu">webgpu</button>
              <button type="button" class="chip-btn" data-query="fluid">navier-stokes</button>
              <button type="button" class="chip-btn" data-query="fractal">raymarching</button>
            </div>
          </div>
          <button type="button" class="btn-reset-filters" id="btn-reset-filters">
            <span>Reset All Filters</span>
            <span>↻</span>
          </button>
        </div>
      `;

      const resetBtn = grid.querySelector('#btn-reset-filters');
      resetBtn?.addEventListener('click', () => this.resetFilters());

      const chips = grid.querySelectorAll<HTMLButtonElement>('.chip-btn');
      chips.forEach(chip => {
        chip.addEventListener('click', () => {
          const query = chip.dataset.query || '';
          const searchInput = document.getElementById('gallery-search-input') as HTMLInputElement | null;
          if (searchInput) {
            searchInput.value = query;
          }
          this.setSearchQuery(query);
        });
      });

      return;
    }

    if (this.layoutMode === 'grid') {
      grid.innerHTML = `
        <div class="exhibits-container exhibits-grid-view">
          ${this.filteredRooms
            .map(
              room => `
            <article class="exhibit-card" data-id="${room.id}" data-category="${room.category}" role="button" tabindex="0" aria-label="Room ${room.indexDisplay}: ${room.name} — ${room.categoryName}. ${room.mathModel}. ${room.description}">
              <div class="card-preview-wrapper">
                <canvas class="card-preview-canvas" data-room-id="${room.id}" width="320" height="200"></canvas>
                <div class="card-badges">
                  <span class="badge-index">${room.indexDisplay}</span>
                  <span class="badge-tech">${room.backendDisplay}</span>
                </div>
                <div class="card-overlay-cta">
                  <span>Enter Room &rarr;</span>
                </div>
              </div>
              <div class="card-placard">
                <div class="card-category-indicator">
                  <span class="category-dot cat-${room.category}"></span>
                  <span class="category-name">${room.categoryName}</span>
                </div>
                <h3 class="card-title">${room.name}</h3>
                <p class="card-desc">${room.description}</p>
                <div class="card-footer-meta">
                  <span class="card-math-tag">${room.mathModel}</span>
                  ${room.tags && room.tags[0] ? `<span class="card-tag-pill">#${room.tags[0]}</span>` : ''}
                </div>
              </div>
            </article>
          `
            )
            .join('')}
        </div>
      `;
    } else {
      grid.innerHTML = `
        <div class="exhibits-container exhibits-list-view">
          ${this.filteredRooms
            .map(
              room => `
            <article class="exhibit-list-row" data-id="${room.id}" data-category="${room.category}" role="button" tabindex="0" aria-label="Room ${room.indexDisplay}: ${room.name} — ${room.categoryName}. ${room.mathModel}">
              <div class="list-col-index">${room.indexDisplay}</div>
              <div class="list-col-preview">
                <canvas class="card-preview-canvas list-preview-canvas" data-room-id="${room.id}" width="64" height="40"></canvas>
              </div>
              <div class="list-col-info">
                <h3 class="list-title">${room.name}</h3>
                <div class="list-meta-category">
                  <span class="category-dot cat-${room.category}"></span>
                  <span>${room.categoryName}</span>
                </div>
              </div>
              <div class="list-col-math">${room.mathModel}</div>
              <div class="list-col-backend">
                <span class="badge-tech">${room.backendDisplay}</span>
              </div>
              <div class="list-col-action">Enter &rarr;</div>
            </article>
          `
            )
            .join('')}
        </div>
      `;
    }

    // Register all preview canvases with the IntersectionObserver throttler
    const canvases = grid.querySelectorAll<HTMLCanvasElement>('.card-preview-canvas');
    canvases.forEach(canvas => {
      const roomId = canvas.dataset.roomId;
      if (roomId && this.miniPreviewManager) {
        this.miniPreviewManager.register(canvas, roomId);
      }
    });

    // Attach click listeners to cards / list rows
    const items = grid.querySelectorAll<HTMLElement>('.exhibit-card, .exhibit-list-row');
    items.forEach(item => {
      const roomId = item.dataset.id;
      if (!roomId) return;

      const navigate = () => {
        const metadata = ROOM_CATALOG.find(r => r.id === roomId);
        const seed = metadata?.defaultParams?.seed || generateRandomSeed();
        router.navigateToRoom(roomId, { seed });
      };

      item.addEventListener('click', navigate);
      item.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigate();
        }
      });
    });
  }

  /**
   * Attaches interactive event listeners to toolbar buttons, filter pills, search input, and keyboard shortcuts.
   */
  private setupEventListeners(): void {
    const signal = this.abortController?.signal;
    if (!signal) return;

    // Explore CTA Button
    const exploreBtn = document.getElementById('hero-btn-explore');
    exploreBtn?.addEventListener(
      'click',
      () => {
        this.lenis?.scrollTo('#gallery-section', { offset: -64, duration: 1.0 });
      },
      { signal }
    );

    // Random Room CTA Button
    const randomBtn = document.getElementById('hero-btn-random');
    randomBtn?.addEventListener('click', () => this.handleRandomRoom(), { signal });

    // Footer Explore Link
    const footerExplore = document.getElementById('footer-link-explore');
    footerExplore?.addEventListener(
      'click',
      () => {
        this.lenis?.scrollTo('#gallery-section', { offset: -64, duration: 1.0 });
      },
      { signal }
    );

    // Footer Random Link
    const footerRandom = document.getElementById('footer-link-random');
    footerRandom?.addEventListener('click', () => this.handleRandomRoom(), { signal });

    // Footer Category Filter Links
    const footerCatLinks = document.querySelectorAll<HTMLElement>('.footer-cat-link');
    footerCatLinks.forEach(link => {
      link.addEventListener(
        'click',
        () => {
          const cat = (link.dataset.cat || 'all') as RoomCategory | 'all';
          this.setCategory(cat);
          this.lenis?.scrollTo('#gallery-section', { offset: -64, duration: 1.0 });
        },
        { signal }
      );
    });

    // Back to Top Button
    const topBtn = document.getElementById('footer-btn-top');
    topBtn?.addEventListener(
      'click',
      () => {
        this.lenis?.scrollTo(0, { duration: 1.0 });
      },
      { signal }
    );

    // Category Pill Clicks & Keyboard Arrow Navigation
    const toolbar = document.getElementById('gallery-toolbar');
    toolbar?.addEventListener(
      'click',
      e => {
        const target = (e.target as HTMLElement).closest<HTMLButtonElement>('.filter-pill');
        if (target && target.dataset.category) {
          this.setCategory(target.dataset.category as RoomCategory | 'all');
        }
      },
      { signal }
    );

    const pillsRow = toolbar?.querySelector<HTMLElement>('.filter-pills-row');
    pillsRow?.addEventListener(
      'keydown',
      e => {
        const pills = Array.from(pillsRow.querySelectorAll<HTMLButtonElement>('.filter-pill'));
        const currentIdx = pills.findIndex(p => p === document.activeElement);
        if (currentIdx === -1) return;

        let nextIdx = currentIdx;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          nextIdx = (currentIdx + 1) % pills.length;
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          nextIdx = (currentIdx - 1 + pills.length) % pills.length;
        } else if (e.key === 'Home') {
          e.preventDefault();
          nextIdx = 0;
        } else if (e.key === 'End') {
          e.preventDefault();
          nextIdx = pills.length - 1;
        }

        if (nextIdx !== currentIdx) {
          const nextPill = pills[nextIdx];
          nextPill.focus();
          const cat = nextPill.dataset.category as RoomCategory | 'all';
          if (cat) {
            this.setCategory(cat);
          }
        }
      },
      { signal }
    );

    // Search Input Real-Time Querying (Debounced 100ms)
    const searchInput = document.getElementById('gallery-search-input') as HTMLInputElement | null;
    const clearBtn = document.getElementById('search-clear-btn');

    searchInput?.addEventListener(
      'input',
      () => {
        const val = searchInput.value;
        if (clearBtn) {
          clearBtn.style.display = val ? 'flex' : 'none';
        }

        if (this.searchDebounceTimer !== null) {
          clearTimeout(this.searchDebounceTimer);
        }

        this.searchDebounceTimer = window.setTimeout(() => {
          this.setSearchQuery(val);
        }, 100);
      },
      { signal }
    );

    // Clear Search Button
    clearBtn?.addEventListener(
      'click',
      () => {
        if (searchInput) {
          searchInput.value = '';
          searchInput.focus();
        }
        clearBtn.style.display = 'none';
        this.setSearchQuery('');
      },
      { signal }
    );

    // Layout Switcher Buttons
    const gridBtn = document.getElementById('layout-btn-grid');
    const listBtn = document.getElementById('layout-btn-list');

    gridBtn?.addEventListener('click', () => this.setLayoutMode('grid'), { signal });
    listBtn?.addEventListener('click', () => this.setLayoutMode('list'), { signal });

    // About Modal Triggers
    const aboutBtn = document.getElementById('header-btn-about');
    aboutBtn?.addEventListener('click', () => this.openAboutModal(aboutBtn), { signal });

    const shortcutsBtn = document.getElementById('header-btn-shortcuts');
    shortcutsBtn?.addEventListener('click', () => this.openAboutModal(shortcutsBtn), { signal });

    const footerAbout = document.getElementById('footer-link-about');
    footerAbout?.addEventListener('click', () => this.openAboutModal(footerAbout), { signal });

    const closeBtn = document.getElementById('modal-close-btn');
    closeBtn?.addEventListener('click', () => this.closeAboutModal(), { signal });

    // Click outside modal panel to dismiss
    const modalBackdrop = document.getElementById('about-modal');
    modalBackdrop?.addEventListener(
      'click',
      e => {
        if (e.target === modalBackdrop) {
          this.closeAboutModal();
        }
      },
      { signal }
    );

    // Global Keyboard Navigation
    window.addEventListener(
      'keydown',
      e => {
        // Trap Tab key navigation within About modal when open
        if (this.isModalOpen && e.key === 'Tab') {
          const modal = document.getElementById('about-modal');
          if (modal) {
            const focusable = Array.from(
              modal.querySelectorAll<HTMLElement>(
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
          }
        }

        // Close modal on Escape
        if (e.key === 'Escape') {
          if (this.isModalOpen) {
            this.closeAboutModal();
            return;
          }
          if (document.activeElement === searchInput && searchInput) {
            searchInput.blur();
            return;
          }
        }

        // Focus search on '/' (unless already in input or modal open)
        const target = e.target as HTMLElement;
        const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

        if (!isInput && !this.isModalOpen && e.key === '/') {
          e.preventDefault();
          if (searchInput) {
            this.lenis?.scrollTo('#gallery-toolbar', { offset: -80, duration: 0.5 });
            searchInput.focus();
            searchInput.select();
          }
          return;
        }

        // Open modal on '?' or 'i' (unless typing in input)
        if (!isInput && (e.key === '?' || e.key === 'i' || e.key === 'I')) {
          e.preventDefault();
          this.toggleAboutModal();
        }
      },
      { signal }
    );
  }

  /**
   * Randomly selects an exhibit room and navigates to it with a fresh deterministic seed.
   */
  private handleRandomRoom(): void {
    if (ROOM_CATALOG.length === 0) return;
    const randomIndex = Math.floor(Math.random() * ROOM_CATALOG.length);
    const room = ROOM_CATALOG[randomIndex];
    const seed = generateRandomSeed();
    router.navigateToRoom(room.id, { seed });
  }

  /**
   * Detects hardware capabilities and updates the live telemetry ribbon.
   */
  private async updateTelemetry(): Promise<void> {
    try {
      const caps = await detectGPUCapabilities();
      const textEl = document.getElementById('telemetry-gpu-text');
      const chipEl = document.getElementById('telemetry-gpu-chip');
      if (textEl && chipEl) {
        textEl.textContent = formatGPUTelemetryBadge(caps);
        if (caps.tier === 'webgpu-full') {
          chipEl.className = 'telemetry-chip mint';
        } else if (caps.tier === 'webgl2-fallback') {
          chipEl.className = 'telemetry-chip amber';
        } else {
          chipEl.className = 'telemetry-chip';
        }
      }
    } catch {
      // Non-critical telemetry display fallback
    }
  }
}
