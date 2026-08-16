/**
 * Aurora Ambient Hero Simulation Canvas
 * 
 * Generates a museum-grade, low-cost, fluid curl-noise vector field
 * with interactive cursor displacement, filament proximity links,
 * and automatic DPR / mobile performance throttling.
 */

import { dampParameter } from './state';
import { getClampedDPR, isMobileDevice } from './gpu';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  size: number;
  color: string;
  alpha: number;
  maxAlpha: number;
  trail: { x: number; y: number }[];
  maxTrailLength: number;
  life: number;
  maxLife: number;
}

export class HeroSimulation {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private container: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private abortController: AbortController | null = null;

  private width = 0;
  private height = 0;
  private dpr = 1;
  private rafId: number | null = null;
  private lastTime = 0;

  private particles: Particle[] = [];
  private maxParticles = 160;
  private maxTrail = 6;
  private proximityDistance = 80;

  // Pointer interaction state
  private pointerX = -1000;
  private pointerY = -1000;
  private smoothedPointerX = -1000;
  private smoothedPointerY = -1000;
  private pointerVelocity = 0;
  private lastPointerX = -1000;
  private lastPointerY = -1000;
  private hasPointerEverMoved = false;

  // Reduced motion preference
  private prefersReducedMotion = false;

  /**
   * Initializes and starts the ambient simulation on the provided canvas.
   */
  public mount(canvas: HTMLCanvasElement, container: HTMLElement): void {
    this.canvas = canvas;
    this.container = container;
    this.ctx = canvas.getContext('2d', { alpha: true });
    if (!this.ctx) return;

    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    this.prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.updateDimensions();
    this.initParticles();

    // Observe size changes of hero section
    this.resizeObserver = new ResizeObserver(() => {
      this.updateDimensions();
    });
    this.resizeObserver.observe(container);

    // Pointer move listener on container & window
    const onPointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const rawX = e.clientX - rect.left;
      const rawY = e.clientY - rect.top;

      if (!this.hasPointerEverMoved) {
        this.smoothedPointerX = rawX;
        this.smoothedPointerY = rawY;
        this.hasPointerEverMoved = true;
      }

      this.pointerX = rawX;
      this.pointerY = rawY;
    };

    const onPointerLeave = () => {
      this.pointerX = -1000;
      this.pointerY = -1000;
    };

    container.addEventListener('pointermove', onPointerMove, { signal });
    container.addEventListener('pointerleave', onPointerLeave, { signal });

    this.lastTime = performance.now();
    this.loop = this.loop.bind(this);
    this.rafId = requestAnimationFrame(this.loop);
  }

  /**
   * Cancels render loop and tears down observers and listeners.
   */
  public destroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    this.particles = [];
    this.canvas = null;
    this.ctx = null;
    this.container = null;
  }

  /**
   * Recalculates canvas resolution and scales according to device constraints.
   */
  private updateDimensions(): void {
    if (!this.canvas || !this.container) return;

    const rect = this.container.getBoundingClientRect();
    this.width = Math.max(rect.width, 320);
    this.height = Math.max(rect.height, 320);

    const isMobile = isMobileDevice() || this.width < 640;
    this.dpr = isMobile ? 1.0 : getClampedDPR(1.5);

    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    // Adjust particle density for performance
    this.maxParticles = isMobile ? 50 : 160;
    this.maxTrail = isMobile ? 3 : 6;
    this.proximityDistance = isMobile ? 55 : 85;

    // Scale context
    if (this.ctx) {
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }
  }

  /**
   * Seeds particles across the canvas area.
   */
  private initParticles(): void {
    this.particles = [];
    const colors = [
      'rgba(0, 240, 255,',   // Cyan
      'rgba(0, 255, 157,',   // Mint
      'rgba(56, 189, 248,',  // Hydro Blue
      'rgba(168, 85, 247,',  // Violet
    ];

    for (let i = 0; i < this.maxParticles; i++) {
      const colorPrefix = colors[i % colors.length];
      const maxAlpha = 0.25 + Math.random() * 0.45;
      const life = Math.random() * 600 + 300;

      this.particles.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        vx: 0,
        vy: 0,
        speed: 0.35 + Math.random() * 0.65,
        size: 1.0 + Math.random() * 1.5,
        color: colorPrefix,
        alpha: 0,
        maxAlpha,
        trail: [],
        maxTrailLength: this.maxTrail,
        life,
        maxLife: life,
      });
    }
  }

  /**
   * 2D Curl Noise vector calculation.
   */
  private computeCurl(x: number, y: number, t: number): { vx: number; vy: number } {
    const eps = 1.0;
    const scale = 0.0022;

    const n1 = this.noise(x * scale, (y + eps) * scale, t);
    const n2 = this.noise(x * scale, (y - eps) * scale, t);
    const n3 = this.noise((x + eps) * scale, y * scale, t);
    const n4 = this.noise((x - eps) * scale, y * scale, t);

    const vx = (n1 - n2) / (2 * eps);
    const vy = -(n3 - n4) / (2 * eps);

    return { vx, vy };
  }

  /**
   * Analytical 3D pseudo-noise hash function.
   */
  private noise(x: number, y: number, z: number): number {
    const s1 = Math.sin(x * 1.8 + z * 0.3) * Math.cos(y * 1.8 + z * 0.2);
    const s2 = Math.sin(x * 3.4 - y * 2.1 + z * 0.45) * 0.5;
    const s3 = Math.cos(x * 0.7 + y * 4.2 + z * 0.15) * 0.25;
    return s1 + s2 + s3;
  }

  /**
   * Main 60 FPS animation loop.
   */
  private loop(currentTime: number): void {
    if (!this.ctx || !this.canvas) return;

    const dt = Math.min((currentTime - this.lastTime) / 1000, 0.05);
    this.lastTime = currentTime;

    // Smooth pointer damping
    if (this.pointerX > -500) {
      this.smoothedPointerX = dampParameter(this.smoothedPointerX, this.pointerX, 4.5, dt);
      this.smoothedPointerY = dampParameter(this.smoothedPointerY, this.pointerY, 4.5, dt);

      const pDeltaX = this.pointerX - this.lastPointerX;
      const pDeltaY = this.pointerY - this.lastPointerY;
      const currentSpeed = Math.sqrt(pDeltaX * pDeltaX + pDeltaY * pDeltaY);
      this.pointerVelocity = dampParameter(this.pointerVelocity, currentSpeed, 3.0, dt);

      this.lastPointerX = this.pointerX;
      this.lastPointerY = this.pointerY;
    } else {
      this.smoothedPointerX = dampParameter(this.smoothedPointerX, -1000, 2.0, dt);
      this.smoothedPointerY = dampParameter(this.smoothedPointerY, -1000, 2.0, dt);
      this.pointerVelocity = dampParameter(this.pointerVelocity, 0, 3.0, dt);
    }

    const t = currentTime * 0.00015;

    // Clear canvas
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Update & render particles
    const len = Math.min(this.particles.length, this.maxParticles);
    const motionMultiplier = this.prefersReducedMotion ? 0.2 : 1.0;

    for (let i = 0; i < len; i++) {
      const p = this.particles[i];

      // Curl noise velocity
      const curl = this.computeCurl(p.x, p.y, t);
      p.vx = dampParameter(p.vx, curl.vx * 65 * p.speed * motionMultiplier, 2.0, dt);
      p.vy = dampParameter(p.vy, curl.vy * 65 * p.speed * motionMultiplier, 2.0, dt);

      // Pointer interactive displacement
      if (this.smoothedPointerX > -500) {
        const dx = p.x - this.smoothedPointerX;
        const dy = p.y - this.smoothedPointerY;
        const distSq = dx * dx + dy * dy;
        const radius = 220;

        if (distSq < radius * radius && distSq > 1) {
          const dist = Math.sqrt(distSq);
          const force = (1 - dist / radius) * (20 + this.pointerVelocity * 1.5);
          
          // Tangential vortex impulse + slight outward repulsion
          const normX = dx / dist;
          const normY = dy / dist;
          p.vx += (-normY * 0.75 + normX * 0.4) * force * dt * 60;
          p.vy += (normX * 0.75 + normY * 0.4) * force * dt * 60;
        }
      }

      // Move particle
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Update trail
      p.trail.unshift({ x: p.x, y: p.y });
      if (p.trail.length > p.maxTrailLength) {
        p.trail.pop();
      }

      // Life & fade cycle
      p.life -= dt * 60;
      if (p.life <= 0 || p.x < -40 || p.x > this.width + 40 || p.y < -40 || p.y > this.height + 40) {
        p.x = Math.random() * this.width;
        p.y = Math.random() * this.height;
        p.vx = 0;
        p.vy = 0;
        p.trail = [];
        p.life = Math.random() * 600 + 300;
        p.maxLife = p.life;
        p.alpha = 0;
      }

      // Smooth alpha envelope
      const lifeRatio = p.life / p.maxLife;
      const targetAlpha = Math.sin(lifeRatio * Math.PI) * p.maxAlpha;
      p.alpha = dampParameter(p.alpha, targetAlpha, 3.0, dt);

      // Render particle trail
      if (p.trail.length > 1) {
        this.ctx.beginPath();
        this.ctx.moveTo(p.trail[0].x, p.trail[0].y);
        for (let j = 1; j < p.trail.length; j++) {
          this.ctx.lineTo(p.trail[j].x, p.trail[j].y);
        }
        this.ctx.strokeStyle = `${p.color} ${p.alpha * 0.4})`;
        this.ctx.lineWidth = p.size * 0.7;
        this.ctx.stroke();
      }

      // Render particle core
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fillStyle = `${p.color} ${p.alpha})`;
      this.ctx.fill();
    }

    // Render subtle proximity filaments
    const maxFilaments = this.prefersReducedMotion ? 0 : Math.min(len, 60);
    this.ctx.lineWidth = 0.5;

    for (let i = 0; i < maxFilaments; i++) {
      const p1 = this.particles[i];
      if (p1.alpha < 0.05) continue;

      for (let j = i + 1; j < Math.min(i + 12, len); j++) {
        const p2 = this.particles[j];
        if (p2.alpha < 0.05) continue;

        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < this.proximityDistance) {
          const filamentAlpha = (1 - dist / this.proximityDistance) * Math.min(p1.alpha, p2.alpha) * 0.35;
          this.ctx.beginPath();
          this.ctx.moveTo(p1.x, p1.y);
          this.ctx.lineTo(p2.x, p2.y);
          this.ctx.strokeStyle = `rgba(0, 240, 255, ${filamentAlpha})`;
          this.ctx.stroke();
        }
      }
    }

    this.rafId = requestAnimationFrame(this.loop);
  }
}
