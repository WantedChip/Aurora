/**
 * Aurora Miniature Simulation Preview Engine & Viewport Throttler
 * 
 * Provides lightweight 2D procedural miniature simulations for all 16 exhibits,
 * managed by an IntersectionObserver with strict performance throttling:
 * - 0 FPS when off-screen
 * - 30 FPS when visible in viewport
 * - 60 FPS + interactive cursor forces on hover
 * - Static single-frame render on prefers-reduced-motion
 */

import { createPRNG, type PRNG } from './prng';

interface PreviewInstance {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  roomId: string;
  prng: PRNG;
  isVisible: boolean;
  isHovered: boolean;
  pointerX: number;
  pointerY: number;
  lastRenderTime: number;
  state: any;
}

export class MiniPreviewManager {
  private instances = new Map<HTMLCanvasElement, PreviewInstance>();
  private observer: IntersectionObserver | null = null;
  private rafId: number | null = null;
  private prefersReducedMotion = false;

  constructor() {
    this.prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.setupObserver();
    this.loop = this.loop.bind(this);
    this.rafId = requestAnimationFrame(this.loop);
  }

  /**
   * Initializes the IntersectionObserver for viewport throttling.
   */
  private setupObserver(): void {
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') {
      return;
    }

    this.observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          const canvas = entry.target as HTMLCanvasElement;
          const instance = this.instances.get(canvas);
          if (instance) {
            instance.isVisible = entry.isIntersecting;
            // If reduced motion, render one initial frame when entering view
            if (this.prefersReducedMotion && entry.isIntersecting) {
              this.renderRoom(instance, performance.now(), 0.016);
            }
          }
        }
      },
      {
        rootMargin: '100px 0px',
        threshold: 0.05,
      }
    );
  }

  /**
   * Registers a canvas element to run a miniature simulation for a given room.
   */
  public register(canvas: HTMLCanvasElement, roomId: string): void {
    if (this.instances.has(canvas)) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const prng = createPRNG(roomId);
    const state = this.createRoomState(roomId, canvas.width, canvas.height, prng);

    const instance: PreviewInstance = {
      canvas,
      ctx,
      roomId,
      prng,
      isVisible: false,
      isHovered: false,
      pointerX: -1,
      pointerY: -1,
      lastRenderTime: 0,
      state,
    };

    this.instances.set(canvas, instance);
    this.observer?.observe(canvas);

    // Initial clear
    ctx.fillStyle = '#0d0f14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Attach hover listeners to the parent card
    const card = canvas.closest('.exhibit-card, .exhibit-list-row');
    if (card) {
      const onPointerEnter = () => {
        instance.isHovered = true;
      };

      const onPointerMove = (e: Event) => {
        const pe = e as PointerEvent;
        const rect = canvas.getBoundingClientRect();
        instance.pointerX = ((pe.clientX - rect.left) / rect.width) * canvas.width;
        instance.pointerY = ((pe.clientY - rect.top) / rect.height) * canvas.height;
      };

      const onPointerLeave = () => {
        instance.isHovered = false;
        instance.pointerX = -1;
        instance.pointerY = -1;
      };

      card.addEventListener('pointerenter', onPointerEnter);
      card.addEventListener('pointermove', onPointerMove);
      card.addEventListener('pointerleave', onPointerLeave);
    }
  }

  /**
   * Unregisters all active canvas previews and disconnects observer.
   */
  public unregisterAll(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
    this.instances.clear();
  }

  /**
   * Completely tears down the preview manager and stops the RAF loop.
   */
  public destroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.unregisterAll();
  }

  /**
   * Main scheduler animation loop applying 0 / 30 / 60 FPS throttling.
   */
  private loop(currentTime: number): void {
    if (this.prefersReducedMotion) {
      // Reduced motion does not continuously loop
      this.rafId = requestAnimationFrame(this.loop);
      return;
    }

    for (const instance of this.instances.values()) {
      if (!instance.isVisible) {
        // Offscreen: 0 FPS
        continue;
      }

      // Throttling target: 60 FPS (16ms) on hover; 30 FPS (32ms) on visible
      const interval = instance.isHovered ? 16 : 33;
      const elapsed = currentTime - instance.lastRenderTime;

      if (elapsed >= interval) {
        const dt = Math.min(elapsed / 1000, 0.05);
        instance.lastRenderTime = currentTime;
        this.renderRoom(instance, currentTime, dt);
      }
    }

    this.rafId = requestAnimationFrame(this.loop);
  }

  /**
   * Creates initial state structure for each room algorithm.
   */
  private createRoomState(roomId: string, w: number, h: number, prng: PRNG): any {
    switch (roomId) {
      case 'flow-field': {
        const particles = [];
        for (let i = 0; i < 70; i++) {
          particles.push({
            x: prng.nextFloat(0, w),
            y: prng.nextFloat(0, h),
            speed: prng.nextFloat(0.8, 1.8),
            hue: prng.choice([184, 157, 199]),
          });
        }
        return { particles, t: 0 };
      }
      case 'domain-warp':
        return { offset: 0 };
      case 'boids': {
        const boids = [];
        for (let i = 0; i < 40; i++) {
          boids.push({
            x: prng.nextFloat(0, w),
            y: prng.nextFloat(0, h),
            vx: prng.nextFloat(-1, 1),
            vy: prng.nextFloat(-1, 1),
          });
        }
        return { boids };
      }
      case 'physarum': {
        const agents = [];
        for (let i = 0; i < 60; i++) {
          agents.push({
            x: prng.nextFloat(0, w),
            y: prng.nextFloat(0, h),
            angle: prng.nextFloat(0, Math.PI * 2),
            speed: prng.nextFloat(0.8, 1.6),
          });
        }
        return { agents };
      }
      case 'particle-life': {
        const species = [];
        for (let i = 0; i < 50; i++) {
          species.push({
            x: prng.nextFloat(0, w),
            y: prng.nextFloat(0, h),
            vx: 0,
            vy: 0,
            color: prng.choice(['#00F0FF', '#00FF9D', '#FFB800', '#FF3366']),
          });
        }
        return { species };
      }
      case 'reaction-diffusion':
        return { phase: 0 };
      case 'lenia':
        return { phase: 0, x: w / 2, y: h / 2 };
      case 'differential-growth': {
        const nodes = [];
        const count = 24;
        for (let i = 0; i < count; i++) {
          const theta = (i / count) * Math.PI * 2;
          nodes.push({
            x: w / 2 + Math.cos(theta) * 35,
            y: h / 2 + Math.sin(theta) * 35,
          });
        }
        return { nodes, t: 0 };
      }
      case 'cyclic-automata':
        return { rot: 0 };
      case 'strange-attractors': {
        return { angle: 0 };
      }
      case 'fractal':
        return { zoom: 1, rot: 0 };
      case 'wave-function-collapse': {
        const grid: number[][] = [];
        const cols = 16;
        const rows = 10;
        for (let r = 0; r < rows; r++) {
          grid[r] = [];
          for (let c = 0; c < cols; c++) {
            grid[r][c] = prng.nextInt(0, 4);
          }
        }
        return { grid, cols, rows, step: 0 };
      }
      case 'fluid': {
        return { splats: [], t: 0 };
      }
      case 'metaballs': {
        const balls = [];
        for (let i = 0; i < 5; i++) {
          balls.push({
            x: prng.nextFloat(w * 0.2, w * 0.8),
            y: prng.nextFloat(h * 0.2, h * 0.8),
            vx: prng.nextFloat(-1, 1),
            vy: prng.nextFloat(-1, 1),
            r: prng.nextFloat(18, 30),
          });
        }
        return { balls };
      }
      case 'galaxy':
        return { rot: 0 };
      case 'kaleidoscope':
        return { rot: 0, scale: 1 };
      case 'fractal-flames': {
        const points: { x: number; y: number }[] = [];
        for (let i = 0; i < 90; i++) {
          points.push({
            x: prng.nextFloat(-1, 1),
            y: prng.nextFloat(-1, 1),
          });
        }
        return { points, rot: 0 };
      }
      case 'video-feedback': {
        return { rot: 0, zoomPhase: 0, rings: 7 };
      }
      case 'plasma': {
        return { t: 0, phase: 0 };
      }
      case 'cymatics': {
        const particles: { x: number; y: number; vx: number; vy: number }[] = [];
        for (let i = 0; i < 220; i++) {
          particles.push({
            x: prng.nextFloat(-0.9, 0.9),
            y: prng.nextFloat(-0.9, 0.9),
            vx: 0,
            vy: 0,
          });
        }
        return { particles, t: 0 };
      }
      case 'moire': {
        return { angle1: 0, angle2: 0, t: 0 };
      }
      case 'tunnel-warp': {
        return { warpPos: 0, rot: 0, t: 0 };
      }
      case 'dla': {
        const branches: { x0: number; y0: number; x1: number; y1: number; age: number }[] = [];
        const walkers: { x: number; y: number }[] = [];
        const cx = w * 0.5;
        const cy = h * 0.5;

        // Pre-generate a compact initial seed tree
        const numInitial = 60;
        let rMax = 8;
        const pts: { x: number; y: number }[] = [{ x: cx, y: cy }];

        for (let i = 1; i < numInitial; i++) {
          const parentIdx = Math.floor(prng.next() * pts.length);
          const parent = pts[parentIdx];
          const angle = prng.next() * Math.PI * 2;
          const dist = prng.nextFloat(2.5, 4.5);
          const px = parent.x + Math.cos(angle) * dist;
          const py = parent.y + Math.sin(angle) * dist;
          pts.push({ x: px, y: py });
          branches.push({ x0: parent.x, y0: parent.y, x1: px, y1: py, age: i / numInitial });
          rMax = Math.max(rMax, Math.hypot(px - cx, py - cy));
        }

        for (let i = 0; i < 30; i++) {
          const a = prng.next() * Math.PI * 2;
          walkers.push({
            x: cx + Math.cos(a) * (rMax + prng.nextFloat(6, 25)),
            y: cy + Math.sin(a) * (rMax + prng.nextFloat(6, 25)),
          });
        }

        return { branches, walkers, pts, rMax, t: 0, growthProgress: numInitial };
      }
      case 'voronoi': {
        const seeds: { x: number; y: number; vx: number; vy: number; origX: number; origY: number }[] = [];
        const numSeeds = 28;
        for (let i = 0; i < numSeeds; i++) {
          const theta = i * 2.399963229728653;
          const r = Math.sqrt((i + 0.5) / numSeeds) * 0.42;
          const sx = w * (0.5 + Math.cos(theta) * r);
          const sy = h * (0.5 + Math.sin(theta) * r);
          seeds.push({
            x: sx,
            y: sy,
            vx: prng.nextFloat(-8, 8),
            vy: prng.nextFloat(-8, 8),
            origX: sx,
            origY: sy,
          });
        }
        return { seeds, t: 0 };
      }
      default:
        return { t: 0 };
    }
  }

  /**
   * Dispatches room-specific 2D simulation rendering.
   */
  private renderRoom(instance: PreviewInstance, _time: number, dt: number): void {
    const { ctx, canvas, roomId, state, pointerX, pointerY, isHovered } = instance;
    const w = canvas.width;
    const h = canvas.height;

    switch (roomId) {
      case 'flow-field': {
        // Semi-transparent fade for vector particle trails
        ctx.fillStyle = 'rgba(13, 15, 20, 0.15)';
        ctx.fillRect(0, 0, w, h);

        state.t += dt * (isHovered ? 2.0 : 1.0);
        for (const p of state.particles) {
          const angle = Math.sin(p.x * 0.02 + state.t) + Math.cos(p.y * 0.02 + state.t);
          p.x += Math.cos(angle) * p.speed;
          p.y += Math.sin(angle) * p.speed;

          if (pointerX > 0) {
            const dx = p.x - pointerX;
            const dy = p.y - pointerY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 60) {
              p.x += (dx / dist) * 2;
              p.y += (dy / dist) * 2;
            }
          }

          if (p.x < 0) p.x = w;
          if (p.x > w) p.x = 0;
          if (p.y < 0) p.y = h;
          if (p.y > h) p.y = 0;

          ctx.fillStyle = `hsla(${p.hue}, 100%, 65%, 0.8)`;
          ctx.fillRect(p.x, p.y, 1.5, 1.5);
        }
        break;
      }

      case 'domain-warp': {
        state.offset += dt * (isHovered ? 0.8 : 0.3);
        const imgData = ctx.createImageData(w, h);
        const data = imgData.data;
        const step = 4; // Sub-sampled for high performance

        for (let y = 0; y < h; y += step) {
          for (let x = 0; x < w; x += step) {
            const nx = (x / w) * 3;
            const ny = (y / h) * 3;
            const q = Math.sin(nx + state.offset) + Math.cos(ny + state.offset);
            const r = Math.sin(nx + q * 1.5) * Math.cos(ny + q * 1.5);
            const val = Math.floor((r * 0.5 + 0.5) * 255);

            for (let dy = 0; dy < step && y + dy < h; dy++) {
              for (let dx = 0; dx < step && x + dx < w; dx++) {
                const idx = ((y + dy) * w + (x + dx)) * 4;
                data[idx] = Math.floor(val * 0.2);
                data[idx + 1] = Math.floor(val * 0.8);
                data[idx + 2] = val;
                data[idx + 3] = 255;
              }
            }
          }
        }
        ctx.putImageData(imgData, 0, 0);
        break;
      }

      case 'boids': {
        ctx.fillStyle = 'rgba(13, 15, 20, 0.25)';
        ctx.fillRect(0, 0, w, h);

        for (const b of state.boids) {
          if (pointerX > 0) {
            const dx = b.x - pointerX;
            const dy = b.y - pointerY;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < 80) {
              b.vx += (dx / d) * 0.4;
              b.vy += (dy / d) * 0.4;
            }
          }

          b.x += b.vx * (isHovered ? 1.5 : 1.0);
          b.y += b.vy * (isHovered ? 1.5 : 1.0);

          if (b.x < 0) b.x = w;
          if (b.x > w) b.x = 0;
          if (b.y < 0) b.y = h;
          if (b.y > h) b.y = 0;

          ctx.fillStyle = '#00F0FF';
          ctx.beginPath();
          ctx.arc(b.x, b.y, 2, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }

      case 'physarum': {
        ctx.fillStyle = 'rgba(13, 15, 20, 0.1)';
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = 'rgba(0, 255, 157, 0.8)';
        for (const a of state.agents) {
          a.angle += (Math.random() - 0.5) * 0.4;
          if (pointerX > 0) {
            const dx = pointerX - a.x;
            const dy = pointerY - a.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < 70) {
              a.angle = Math.atan2(dy, dx);
            }
          }

          a.x += Math.cos(a.angle) * a.speed * (isHovered ? 1.6 : 1.0);
          a.y += Math.sin(a.angle) * a.speed * (isHovered ? 1.6 : 1.0);

          if (a.x < 0) a.x = w;
          if (a.x > w) a.x = 0;
          if (a.y < 0) a.y = h;
          if (a.y > h) a.y = 0;

          ctx.fillRect(a.x, a.y, 1.8, 1.8);
        }
        break;
      }

      case 'particle-life': {
        ctx.fillStyle = 'rgba(13, 15, 20, 0.3)';
        ctx.fillRect(0, 0, w, h);

        for (const p of state.species) {
          p.x += p.vx;
          p.y += p.vy;

          if (pointerX > 0) {
            const dx = pointerX - p.x;
            const dy = pointerY - p.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < 70) {
              p.vx += (dx / d) * 0.15;
              p.vy += (dy / d) * 0.15;
            }
          }

          p.vx *= 0.95;
          p.vy *= 0.95;

          if (p.x < 0) p.x = w;
          if (p.x > w) p.x = 0;
          if (p.y < 0) p.y = h;
          if (p.y > h) p.y = 0;

          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }

      case 'reaction-diffusion': {
        ctx.fillStyle = '#0d0f14';
        ctx.fillRect(0, 0, w, h);

        state.phase += dt * (isHovered ? 1.5 : 0.8);
        ctx.strokeStyle = '#00FF9D';
        ctx.lineWidth = 2;

        const cols = 8;
        const rows = 5;
        const cellW = w / cols;
        const cellH = h / rows;

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const cx = c * cellW + cellW / 2;
            const cy = r * cellH + cellH / 2;
            const radius = 8 + Math.sin(state.phase + (c + r) * 0.5) * 6;
            ctx.beginPath();
            ctx.arc(cx, cy, Math.max(radius, 1), 0, Math.PI * 2);
            ctx.stroke();
          }
        }
        break;
      }

      case 'lenia': {
        ctx.fillStyle = '#0d0f14';
        ctx.fillRect(0, 0, w, h);

        state.phase += dt * (isHovered ? 2.5 : 1.2);
        const cx = w / 2 + Math.cos(state.phase * 0.5) * 20;
        const cy = h / 2 + Math.sin(state.phase * 0.7) * 15;

        const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, 45);
        grad.addColorStop(0, 'rgba(0, 255, 157, 0.9)');
        grad.addColorStop(0.5, 'rgba(0, 240, 255, 0.4)');
        grad.addColorStop(1, 'transparent');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, 45, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'differential-growth': {
        ctx.fillStyle = 'rgba(13, 15, 20, 0.2)';
        ctx.fillRect(0, 0, w, h);

        state.t += dt * (isHovered ? 2.0 : 1.0);
        ctx.strokeStyle = '#FFB800';
        ctx.lineWidth = 1.5;

        ctx.beginPath();
        for (let i = 0; i < state.nodes.length; i++) {
          const wobble = Math.sin(state.t + i * 0.5) * 8;
          const theta = (i / state.nodes.length) * Math.PI * 2;
          const x = w / 2 + Math.cos(theta) * (40 + wobble);
          const y = h / 2 + Math.sin(theta) * (30 + wobble);

          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
        break;
      }

      case 'cyclic-automata': {
        state.rot += dt * (isHovered ? 2.0 : 0.8);
        ctx.fillStyle = '#0d0f14';
        ctx.fillRect(0, 0, w, h);

        const cx = w / 2;
        const cy = h / 2;
        for (let i = 0; i < 8; i++) {
          const angle = state.rot + (i / 8) * Math.PI * 2;
          const r = 20 + i * 6;
          ctx.strokeStyle = `hsl(${(i * 45 + state.rot * 40) % 360}, 90%, 60%)`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(cx, cy, r, angle, angle + Math.PI * 1.2);
          ctx.stroke();
        }
        break;
      }

      case 'strange-attractors': {
        ctx.fillStyle = 'rgba(13, 15, 20, 0.2)';
        ctx.fillRect(0, 0, w, h);

        state.angle += dt * (isHovered ? 1.5 : 0.6);
        ctx.fillStyle = '#00F0FF';

        const count = 80;
        let x = 0.1, y = 0, z = 0;
        const dtSim = 0.01;
        const a = 10, b = 28, c = 8 / 3;

        for (let i = 0; i < count; i++) {
          const dx = a * (y - x) * dtSim;
          const dy = (x * (b - z) - y) * dtSim;
          const dz = (x * y - c * z) * dtSim;
          x += dx; y += dy; z += dz;

          // 3D rotation projection
          const rotX = x * Math.cos(state.angle) - z * Math.sin(state.angle);
          const screenX = w / 2 + rotX * 3.5;
          const screenY = h / 2 + (y - 20) * 2.2;

          ctx.fillRect(screenX, screenY, 1.5, 1.5);
        }
        break;
      }

      case 'fractal': {
        state.rot += dt * (isHovered ? 1.2 : 0.4);
        ctx.fillStyle = '#0d0f14';
        ctx.fillRect(0, 0, w, h);

        const cx = w / 2;
        const cy = h / 2;
        const grad = ctx.createRadialGradient(cx, cy, 5, cx, cy, 50);
        grad.addColorStop(0, '#C084FC');
        grad.addColorStop(0.5, '#7928CA');
        grad.addColorStop(1, 'transparent');

        ctx.fillStyle = grad;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = state.rot + (i / 6) * Math.PI * 2;
          const r = 25 + Math.sin(state.rot * 2 + i) * 10;
          ctx.arc(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r, 12, 0, Math.PI * 2);
        }
        ctx.fill();
        break;
      }

      case 'wave-function-collapse': {
        ctx.fillStyle = '#0d0f14';
        ctx.fillRect(0, 0, w, h);

        state.step += dt * (isHovered ? 4.0 : 1.5);
        const cellW = w / state.cols;
        const cellH = h / state.rows;

        ctx.strokeStyle = '#00FF9D';
        ctx.lineWidth = 1.5;

        for (let r = 0; r < state.rows; r++) {
          for (let c = 0; c < state.cols; c++) {
            const tile = state.grid[r][c];
            const x = c * cellW;
            const y = r * cellH;

            ctx.beginPath();
            if (tile === 0) {
              ctx.moveTo(x + cellW / 2, y);
              ctx.lineTo(x + cellW / 2, y + cellH);
            } else if (tile === 1) {
              ctx.moveTo(x, y + cellH / 2);
              ctx.lineTo(x + cellW, y + cellH / 2);
            } else if (tile === 2) {
              ctx.arc(x, y, cellW / 2, 0, Math.PI / 2);
            } else {
              ctx.arc(x + cellW, y + cellH, cellW / 2, Math.PI, Math.PI * 1.5);
            }
            ctx.stroke();
          }
        }
        break;
      }

      case 'fluid': {
        ctx.fillStyle = 'rgba(13, 15, 20, 0.15)';
        ctx.fillRect(0, 0, w, h);

        state.t += dt * (isHovered ? 2.5 : 1.0);
        const cx = pointerX > 0 ? pointerX : w / 2 + Math.cos(state.t) * 40;
        const cy = pointerY > 0 ? pointerY : h / 2 + Math.sin(state.t * 1.4) * 25;

        const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, 40);
        grad.addColorStop(0, 'rgba(56, 189, 248, 0.85)');
        grad.addColorStop(0.5, 'rgba(0, 240, 255, 0.3)');
        grad.addColorStop(1, 'transparent');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, 40, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'metaballs': {
        ctx.fillStyle = '#0d0f14';
        ctx.fillRect(0, 0, w, h);

        for (const b of state.balls) {
          b.x += b.vx * (isHovered ? 1.8 : 1.0);
          b.y += b.vy * (isHovered ? 1.8 : 1.0);

          if (b.x < b.r || b.x > w - b.r) b.vx *= -1;
          if (b.y < b.r || b.y > h - b.r) b.vy *= -1;

          const grad = ctx.createRadialGradient(b.x, b.y, 2, b.x, b.y, b.r);
          grad.addColorStop(0, 'rgba(255, 184, 0, 0.9)');
          grad.addColorStop(0.6, 'rgba(245, 158, 11, 0.4)');
          grad.addColorStop(1, 'transparent');

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }

      case 'galaxy': {
        ctx.fillStyle = 'rgba(13, 15, 20, 0.2)';
        ctx.fillRect(0, 0, w, h);

        state.rot += dt * (isHovered ? 1.2 : 0.4);
        const cx = w / 2;
        const cy = h / 2;

        for (let i = 0; i < 90; i++) {
          const arm = i % 3;
          const theta = state.rot + (arm * (Math.PI * 2)) / 3 + (i / 90) * 4.0;
          const r = (i / 90) * 55 + 6;
          const x = cx + Math.cos(theta) * r;
          const y = cy + Math.sin(theta) * r * 0.6; // elliptic tilt

          ctx.fillStyle = i < 15 ? '#FFFFFF' : i < 50 ? '#C084FC' : '#38BDF8';
          ctx.fillRect(x, y, 1.5, 1.5);
        }
        break;
      }

      case 'kaleidoscope': {
        state.rot += dt * (isHovered ? 1.8 : 0.6);
        ctx.fillStyle = '#0d0f14';
        ctx.fillRect(0, 0, w, h);

        const cx = w / 2;
        const cy = h / 2;
        const folds = 8;

        ctx.strokeStyle = '#FF3366';
        ctx.lineWidth = 1.5;

        for (let i = 0; i < folds; i++) {
          const angle = state.rot + (i / folds) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          const x1 = cx + Math.cos(angle) * 45;
          const y1 = cy + Math.sin(angle) * 45;
          const x2 = cx + Math.cos(angle + 0.3) * 25;
          const y2 = cy + Math.sin(angle + 0.3) * 25;
          ctx.lineTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
        break;
      }

      case 'fractal-flames': {
        state.rot += dt * (isHovered ? 1.4 : 0.4);
        ctx.fillStyle = 'rgba(13, 15, 20, 0.25)';
        ctx.fillRect(0, 0, w, h);

        const cx = w / 2;
        const cy = h / 2;
        const scale = Math.min(w, h) * 0.38;
        const cosR = Math.cos(state.rot);
        const sinR = Math.sin(state.rot);

        for (let i = 0; i < state.points.length; i++) {
          const pt = state.points[i];
          const r2 = pt.x * pt.x + pt.y * pt.y + 0.05;
          const nx = pt.x * Math.sin(r2) - pt.y * Math.cos(r2);
          const ny = pt.x * Math.cos(r2) + pt.y * Math.sin(r2);
          pt.x = nx * 0.72 + (Math.random() - 0.5) * 0.08;
          pt.y = ny * 0.72 + (Math.random() - 0.5) * 0.08;
          if (Math.abs(pt.x) > 2 || Math.abs(pt.y) > 2) {
            pt.x = (Math.random() - 0.5) * 1.2;
            pt.y = (Math.random() - 0.5) * 1.2;
          }

          const rx = pt.x * cosR - pt.y * sinR;
          const ry = pt.x * sinR + pt.y * cosR;
          const px = cx + rx * scale;
          const py = cy + ry * scale;

          ctx.fillStyle = i % 2 === 0 ? '#00F0FF' : '#FF2A6D';
          ctx.fillRect(px, py, 1.5, 1.5);
        }
        break;
      }

      case 'video-feedback': {
        state.rot += dt * (isHovered ? 1.6 : 0.6);
        state.zoomPhase += dt * (isHovered ? 2.0 : 0.8);
        ctx.fillStyle = 'rgba(9, 10, 13, 0.22)';
        ctx.fillRect(0, 0, w, h);

        const cx = w / 2 + (pointerX >= 0 ? (pointerX - w / 2) * 0.15 : 0);
        const cy = h / 2 + (pointerY >= 0 ? (pointerY - h / 2) * 0.15 : 0);
        const count = 10;
        const maxR = Math.min(w, h) * 0.46;

        ctx.lineWidth = 1.5;
        for (let i = 0; i < count; i++) {
          const progress = ((i / count) + (state.zoomPhase * 0.15)) % 1.0;
          const r = progress * maxR + 3;
          const angle = state.rot + i * 0.25;
          const alpha = Math.sin(progress * Math.PI);

          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(angle);
          ctx.strokeStyle = i % 2 === 0 ? `rgba(0, 240, 255, ${alpha * 0.85})` : `rgba(168, 85, 247, ${alpha * 0.85})`;
          ctx.strokeRect(-r, -r, r * 2, r * 2);
          ctx.restore();
        }
        break;
      }

      case 'plasma': {
        state.t += dt * (isHovered ? 2.5 : 1.2);
        state.phase += dt * (isHovered ? 1.8 : 0.8);
        const t = state.t;
        const phase = state.phase;
        const aspect = w / h;
        const step = 4;
        const imgData = ctx.createImageData(w, h);
        const data = imgData.data;

        const ptrX = pointerX >= 0 ? (pointerX / w - 0.5) * aspect : 0;
        const ptrY = pointerY >= 0 ? pointerY / h - 0.5 : 0;
        const hasPtr = pointerX >= 0;

        for (let y = 0; y < h; y += step) {
          const v = (y / h) - 0.5;
          for (let x = 0; x < w; x += step) {
            const u = (x / w - 0.5) * aspect;

            const wx = u + 0.3 * Math.sin(v * 3.0 + t * 0.8);
            const wy = v + 0.3 * Math.cos(u * 3.0 + t * 0.9);

            const w1 = Math.sin(wx * 4.0 + t);
            const w2 = Math.sin(wy * 4.0 + t * 1.2);
            const w3 = Math.sin((wx * 0.7 + wy * 0.7) * 5.0 + t * 1.4);
            const r4 = Math.sqrt(wx * wx + wy * wy + 0.0001);
            const w4 = Math.sin(r4 * 6.0 - t * 1.6);

            let w5 = 0;
            if (hasPtr) {
              const dx = wx - ptrX;
              const dy = wy - ptrY;
              const d = Math.sqrt(dx * dx + dy * dy + 0.0001);
              w5 = Math.sin(d * 16.0 - t * 3.0) * Math.exp(-3.0 * d) * 1.5;
            }

            const pVal = (w1 + w2 + w3 + w4 + w5) * 0.25 * 1.4 + phase;

            const twoPi = Math.PI * 2.0;
            const cr = Math.min(Math.max(0.5 + 0.5 * Math.cos(twoPi * (pVal)), 0), 1);
            const cg = Math.min(Math.max(0.5 + 0.5 * Math.cos(twoPi * (pVal + 0.333)), 0), 1);
            const cb = Math.min(Math.max(0.5 + 0.5 * Math.cos(twoPi * (pVal + 0.667)), 0), 1);

            const rByte = Math.floor(cr * 255);
            const gByte = Math.floor(cg * 255);
            const bByte = Math.floor(cb * 255);

            for (let dy = 0; dy < step && y + dy < h; dy++) {
              for (let dx = 0; dx < step && x + dx < w; dx++) {
                const idx = ((y + dy) * w + (x + dx)) * 4;
                data[idx] = rByte;
                data[idx + 1] = gByte;
                data[idx + 2] = bByte;
                data[idx + 3] = 255;
              }
            }
          }
        }
        ctx.putImageData(imgData, 0, 0);
        break;
      }

      case 'cymatics': {
        state.t += dt * (isHovered ? 2.0 : 1.0);
        ctx.fillStyle = 'rgba(9, 10, 13, 0.28)';
        ctx.fillRect(0, 0, w, h);

        const cx = w * 0.5;
        const cy = h * 0.5;
        const scale = Math.min(w, h) * 0.44;

        // Draw subtle plate boundary
        ctx.strokeStyle = 'rgba(212, 175, 55, 0.4)';
        ctx.lineWidth = 1.0;
        ctx.strokeRect(cx - scale, cy - scale, scale * 2, scale * 2);

        const n = isHovered ? 4 : 3;
        const m = isHovered ? 4 : 3;
        const ptrNormX = pointerX >= 0 ? (pointerX - cx) / scale : -999;
        const ptrNormY = pointerY >= 0 ? (pointerY - cy) / scale : -999;

        for (let i = 0; i < state.particles.length; i++) {
          const p = state.particles[i];
          const kx1 = 0.5 * n * Math.PI;
          const ky1 = 0.5 * m * Math.PI;

          const cosNX = Math.cos(kx1 * p.x);
          const sinNX = Math.sin(kx1 * p.x);
          const cosMY = Math.cos(ky1 * p.y);
          const sinMY = Math.sin(ky1 * p.y);
          const cosMX = Math.cos(ky1 * p.x);
          const sinMX = Math.sin(ky1 * p.x);
          const cosNY = Math.cos(kx1 * p.y);
          const sinNY = Math.sin(kx1 * p.y);

          const wVal = cosNX * cosMY - cosMX * cosNY;
          const gradX = -kx1 * sinNX * cosMY + ky1 * sinMX * cosNY;
          const gradY = -ky1 * cosNX * sinMY + kx1 * cosMX * sinNY;

          const signW = wVal >= 0 ? 1 : -1;
          const fxDrift = -signW * gradX * 3.5;
          const fyDrift = -signW * gradY * 3.5;

          const amp = Math.abs(wVal);
          const randAngle = i * 2.4 + state.t * 8.0;
          const fxAgitation = Math.cos(randAngle) * amp * 2.2;
          const fyAgitation = Math.sin(randAngle) * amp * 2.2;

          p.vx = (p.vx + (fxDrift + fxAgitation) * dt) * 0.92;
          p.vy = (p.vy + (fyDrift + fyAgitation) * dt) * 0.92;

          // Pointer interaction
          if (ptrNormX > -2) {
            const dx = p.x - ptrNormX;
            const dy = p.y - ptrNormY;
            const d = Math.sqrt(dx * dx + dy * dy + 0.001);
            if (d < 0.4) {
              p.vx += (dx / d) * 3.0 * (1.0 - d / 0.4);
              p.vy += (dy / d) * 3.0 * (1.0 - d / 0.4);
            }
          }

          p.x += p.vx * dt;
          p.y += p.vy * dt;

          if (p.x > 0.95) { p.x = 0.95; p.vx *= -0.5; }
          if (p.x < -0.95) { p.x = -0.95; p.vx *= -0.5; }
          if (p.y > 0.95) { p.y = 0.95; p.vy *= -0.5; }
          if (p.y < -0.95) { p.y = -0.95; p.vy *= -0.5; }

          const scrX = cx + p.x * scale;
          const scrY = cy + p.y * scale;

          ctx.fillStyle = amp < 0.25 ? '#D4AF37' : '#FFF5CC';
          ctx.fillRect(scrX - 1, scrY - 1, 2, 2);
        }
        break;
      }

      case 'moire': {
        state.t += dt * (isHovered ? 2.2 : 1.0);
        state.angle1 += dt * (isHovered ? 0.35 : 0.15);
        state.angle2 -= dt * (isHovered ? 0.45 : 0.2);

        ctx.fillStyle = '#090A0D';
        ctx.fillRect(0, 0, w, h);

        const cx = w * 0.5;
        const cy = h * 0.5;
        const maxR = Math.min(w, h) * 0.44;

        const ptrShiftX = pointerX >= 0 ? (pointerX - cx) * 0.25 : Math.sin(state.t * 0.8) * 12;
        const ptrShiftY = pointerY >= 0 ? (pointerY - cy) * 0.25 : Math.cos(state.t * 0.9) * 8;

        const rings = 28;
        const step = maxR / rings;

        // Layer 1 concentric circles
        ctx.lineWidth = 1.2;
        for (let i = 1; i <= rings; i++) {
          const r = i * step;
          const alpha = 0.55 + 0.3 * Math.sin(i * 0.4 + state.t);
          ctx.strokeStyle = `rgba(0, 240, 255, ${alpha * 0.7})`;
          ctx.beginPath();
          ctx.arc(cx - ptrShiftX * 0.5, cy - ptrShiftY * 0.5, r, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Layer 2 offset concentric circles creating dynamic hyperbolic moiré beat fringes
        for (let i = 1; i <= rings; i++) {
          const r = i * step;
          const alpha = 0.55 + 0.3 * Math.cos(i * 0.4 - state.t);
          ctx.strokeStyle = isHovered ? `rgba(255, 42, 109, ${alpha * 0.75})` : `rgba(244, 246, 251, ${alpha * 0.7})`;
          ctx.beginPath();
          ctx.arc(cx + ptrShiftX * 0.8, cy + ptrShiftY * 0.8, r, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Starburst spoke rays intersecting for rotary moiré
        const spokes = 20;
        ctx.strokeStyle = 'rgba(212, 175, 55, 0.25)';
        ctx.lineWidth = 1.0;
        for (let i = 0; i < spokes; i++) {
          const a1 = state.angle1 + (i / spokes) * Math.PI * 2;
          const a2 = state.angle2 + (i / spokes) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + Math.cos(a1) * maxR, cy + Math.sin(a1) * maxR);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(cx + ptrShiftX, cy + ptrShiftY);
          ctx.lineTo(cx + ptrShiftX + Math.cos(a2) * maxR, cy + ptrShiftY + Math.sin(a2) * maxR);
          ctx.stroke();
        }

        break;
      }

      case 'tunnel-warp': {
        const speed = isHovered ? 4.5 : 2.0;
        state.t += dt;
        state.warpPos += dt * speed;
        state.rot += dt * (isHovered ? 0.6 : 0.25);

        ctx.fillStyle = '#090A0D';
        ctx.fillRect(0, 0, w, h);

        const cx = w * 0.5;
        const cy = h * 0.5;
        const maxR = Math.hypot(cx, cy);

        const ptrShiftX = pointerX >= 0 ? (pointerX - cx) * 0.4 : Math.sin(state.t * 1.2) * 15;
        const ptrShiftY = pointerY >= 0 ? (pointerY - cy) * 0.4 : Math.cos(state.t * 0.9) * 12;

        const focalX = cx + ptrShiftX;
        const focalY = cy + ptrShiftY;

        // Concentric depth rings expanding outwards (wormhole warp)
        const ringCount = 14;
        const phase = state.warpPos % 1.0;

        ctx.lineWidth = isHovered ? 1.8 : 1.2;
        for (let i = 0; i < ringCount; i++) {
          const frac = (i + phase) / ringCount;
          const r = Math.pow(frac, 2.2) * maxR;
          const alpha = Math.sin(frac * Math.PI) * (isHovered ? 0.9 : 0.7);

          const bendX = Math.sin(frac * 4.0 - state.t * 2.0) * ptrShiftX * 0.5;
          const bendY = Math.cos(frac * 3.5 - state.t * 2.0) * ptrShiftY * 0.5;

          ctx.strokeStyle = i % 2 === 0
            ? `rgba(0, 240, 255, ${alpha})`
            : `rgba(255, 42, 109, ${alpha * 0.85})`;

          ctx.beginPath();
          ctx.ellipse(focalX + bendX, focalY + bendY, r, r * 0.85, state.rot * 0.5, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Longitudinal laser beams rushing from focal center to edges
        const beamCount = 12;
        ctx.strokeStyle = 'rgba(0, 255, 157, 0.45)';
        ctx.lineWidth = 1.0;
        for (let i = 0; i < beamCount; i++) {
          const a = state.rot + (i / beamCount) * Math.PI * 2;
          const endX = focalX + Math.cos(a) * maxR * 1.5;
          const endY = focalY + Math.sin(a) * maxR * 1.5;

          ctx.beginPath();
          ctx.moveTo(focalX, focalY);
          ctx.lineTo(endX, endY);
          ctx.stroke();
        }

        // Singularity void core
        ctx.fillStyle = '#090A0D';
        ctx.beginPath();
        ctx.arc(focalX, focalY, 10, 0, Math.PI * 2);
        ctx.fill();

        break;
      }

      case 'dla': {
        state.t += dt;
        const speed = isHovered ? 2.2 : 1.0;
        const cx = w * 0.5;
        const cy = h * 0.5;

        ctx.fillStyle = '#090A0D';
        ctx.fillRect(0, 0, w, h);

        // Active Brownian walkers diffusing around perimeter
        ctx.fillStyle = 'rgba(0, 240, 255, 0.35)';
        for (let i = 0; i < state.walkers.length; i++) {
          const wk = state.walkers[i];
          const angle = Math.sin(state.t * 3.0 + i * 1.7) * Math.PI * 2;
          wk.x += Math.cos(angle) * 1.8 * speed;
          wk.y += Math.sin(angle) * 1.8 * speed;

          const dist = Math.hypot(wk.x - cx, wk.y - cy);
          if (dist > state.rMax * 2.2 + 30 || dist < 2) {
            const a = Math.random() * Math.PI * 2;
            wk.x = cx + Math.cos(a) * (state.rMax + 10);
            wk.y = cy + Math.sin(a) * (state.rMax + 10);
          }

          ctx.fillRect(wk.x - 0.75, wk.y - 0.75, 1.5, 1.5);
        }

        // Draw Dendritic crystal branches
        ctx.lineCap = 'round';
        ctx.lineWidth = isHovered ? 1.6 : 1.2;

        for (let i = 0; i < state.branches.length; i++) {
          const b = state.branches[i];
          const frac = b.age;
          const alpha = 0.4 + 0.55 * frac;
          ctx.strokeStyle = frac < 0.3
            ? `rgba(0, 180, 216, ${alpha * 0.7})`
            : frac < 0.7
            ? `rgba(0, 240, 255, ${alpha})`
            : `rgba(0, 255, 157, ${alpha})`;

          ctx.beginPath();
          ctx.moveTo(b.x0, b.y0);
          ctx.lineTo(b.x1, b.y1);
          ctx.stroke();
        }

        // Growing tips glowing beacons
        const tipCount = Math.min(10, state.branches.length);
        const pulse = 1.0 + Math.sin(state.t * 6.0) * 0.3;
        ctx.fillStyle = 'rgba(244, 246, 251, 0.9)';
        for (let i = state.branches.length - tipCount; i < state.branches.length; i++) {
          if (i < 0) continue;
          const b = state.branches[i];
          ctx.beginPath();
          ctx.arc(b.x1, b.y1, (isHovered ? 2.2 : 1.5) * pulse, 0, Math.PI * 2);
          ctx.fill();
        }

        // Nucleus central seed
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
        ctx.fill();

        break;
      }

      case 'voronoi': {
        state.t += dt * (isHovered ? 1.8 : 1.0);
        ctx.fillStyle = '#090A0D';
        ctx.fillRect(0, 0, w, h);

        const seeds = state.seeds;
        const count = seeds.length;

        // Animate seeds with subtle organic breathing and hover interactive displacement
        for (let i = 0; i < count; i++) {
          const s = seeds[i];
          const breath = Math.sin(state.t * 1.8 + i * 0.5) * 6;
          s.x = s.origX + Math.cos(state.t * 0.8 + i) * breath;
          s.y = s.origY + Math.sin(state.t * 0.8 + i) * breath;

          if (isHovered) {
            const dx = s.x - pointerX;
            const dy = s.y - pointerY;
            const dist = Math.hypot(dx, dy);
            if (dist < 60 && dist > 1) {
              s.x += (dx / dist) * (60 - dist) * 0.15;
              s.y += (dy / dist) * (60 - dist) * 0.15;
            }
          }
        }

        // Draw Voronoi Delaunay/neighbor web lattice
        ctx.lineWidth = isHovered ? 1.5 : 1.0;
        for (let i = 0; i < count; i++) {
          const s1 = seeds[i];
          // Find 3 closest seeds
          const neighbors: { s: any; d: number }[] = [];
          for (let j = 0; j < count; j++) {
            if (i === j) continue;
            const dist = Math.hypot(s1.x - seeds[j].x, s1.y - seeds[j].y);
            neighbors.push({ s: seeds[j], d: dist });
          }
          neighbors.sort((a, b) => a.d - b.d);

          for (let k = 0; k < Math.min(3, neighbors.length); k++) {
            const s2 = neighbors[k].s;
            if (s1.x < s2.x) {
              const alpha = Math.max(0.15, 1.0 - neighbors[k].d / (w * 0.35));
              ctx.strokeStyle = k === 0
                ? `rgba(0, 255, 157, ${alpha * 0.8})`
                : `rgba(0, 240, 255, ${alpha * 0.5})`;
              ctx.beginPath();
              ctx.moveTo(s1.x, s1.y);
              ctx.lineTo(s2.x, s2.y);
              ctx.stroke();
            }
          }
        }

        // Draw seed nucleus centers and glowing halos
        for (let i = 0; i < count; i++) {
          const s = seeds[i];
          const pulse = 1.0 + Math.sin(state.t * 3.0 + i) * 0.25;

          // Glowing center
          ctx.fillStyle = '#F4F6FB';
          ctx.beginPath();
          ctx.arc(s.x, s.y, 1.5 * pulse, 0, Math.PI * 2);
          ctx.fill();

          // Soft neon halo
          ctx.fillStyle = i % 2 === 0 ? 'rgba(0, 255, 157, 0.3)' : 'rgba(0, 240, 255, 0.3)';
          ctx.beginPath();
          ctx.arc(s.x, s.y, 3.5 * pulse, 0, Math.PI * 2);
          ctx.fill();
        }

        // Pointer seed highlight if hovered
        if (isHovered) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(pointerX, pointerY, 6.0, 0, Math.PI * 2);
          ctx.stroke();
        }

        break;
      }

      default:
        break;
    }
  }
}
