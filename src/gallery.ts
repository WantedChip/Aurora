/**
 * Aurora Gallery View & Archival Shell Orchestrator
 * Direction: Obsidian Archival Minimal
 */

import Lenis from 'lenis';
import { ROOM_CATALOG } from './rooms/registry';
import { generateRandomSeed } from './lib/prng';
import { detectGPUCapabilities, formatGPUTelemetryBadge } from './lib/gpu';
import { router } from './lib/router';

export class GalleryView {
  private container: HTMLElement | null = null;
  private lenis: Lenis | null = null;
  private abortController: AbortController | null = null;
  private isModalOpen = false;

  /**
   * Assembles and mounts the complete landing page gallery shell into the specified DOM element.
   */
  public async mount(container: HTMLElement): Promise<void> {
    this.container = container;
    this.abortController = new AbortController();

    this.renderDOM();
    this.setupLenis();
    this.setupEventListeners();
    this.updateTelemetry();
  }

  /**
   * Tears down the gallery view, cleans up Lenis, and removes DOM event listeners.
   */
  public destroy(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
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
   * Opens the curatorial About / Info modal dialog.
   */
  public openAboutModal(): void {
    const modal = document.getElementById('about-modal');
    if (!modal) return;

    this.isModalOpen = true;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');

    // Prevent body background scroll while modal is active
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
   * Renders the complete HTML structure of the gallery shell.
   */
  private renderDOM(): void {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="gallery-shell">
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

          <!-- Dynamic Mount Points for Future Sub-phases -->
          <div id="gallery-toolbar" class="gallery-toolbar-mount"></div>
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
                  <li class="footer-link" data-cat="field-flow">Field &amp; Flow Dynamics</li>
                  <li class="footer-link" data-cat="art-life">Artificial Life &amp; Turing</li>
                  <li class="footer-link" data-cat="chaos">Mathematical Chaos &amp; Fractals</li>
                  <li class="footer-link" data-cat="fluid">Navier-Stokes &amp; Isosurfaces</li>
                  <li class="footer-link" data-cat="cosmic">Cosmic Density Waves</li>
                  <li class="footer-link" data-cat="audio">Audio-Reactive Optics</li>
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
              <span>Aurora v0.2.0 • Obsidian Archival Minimal</span>
              <span>Press <kbd style="color: var(--accent-cyan);">Esc</kbd> to close</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Attaches interactive event listeners to buttons, modal triggers, and keyboard shortcuts.
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

    // Back to Top Button
    const topBtn = document.getElementById('footer-btn-top');
    topBtn?.addEventListener(
      'click',
      () => {
        this.lenis?.scrollTo(0, { duration: 1.0 });
      },
      { signal }
    );

    // About Modal Triggers
    const aboutBtn = document.getElementById('header-btn-about');
    aboutBtn?.addEventListener('click', () => this.openAboutModal(), { signal });

    const shortcutsBtn = document.getElementById('header-btn-shortcuts');
    shortcutsBtn?.addEventListener('click', () => this.openAboutModal(), { signal });

    const footerAbout = document.getElementById('footer-link-about');
    footerAbout?.addEventListener('click', () => this.openAboutModal(), { signal });

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
        // Close modal on Escape
        if (e.key === 'Escape' && this.isModalOpen) {
          this.closeAboutModal();
          return;
        }

        // Open modal on '?' or 'i' (unless typing in input)
        const target = e.target as HTMLElement;
        const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
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
