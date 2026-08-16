/**
 * Room 01: Flow Field
 * Curatorial Category: Field & Flow
 * Math Model: Perlin & Curl Vector Noise Trails
 * Compute Engine: Canvas 2D
 * Aesthetic Direction: Obsidian Archival Minimal
 * 
 * Features:
 * - Real-time divergence-free 2D Curl Noise vector fields (∇ × ψ)
 * - Multi-octave Fractional Brownian Motion (fBm) potential surface
 * - 1,000 to 25,000 particle capacity with typed Float32Array storage
 * - Semi-transparent decaying luminous trails over Obsidian void (#090A0D)
 * - Direction-mapped chromatic color palettes
 * - Smooth pointer vortex & fluid impulse interaction
 * - Frame-rate independent exponential damping & determinism
 * - Custom high-density 4K/8K snapshot accumulation pass
 */

import type {
  RoomInstance,
  RoomContext,
  RoomCleanupFn,
  RoomPointerEvent,
} from '../types';
import { createPRNG, type PRNG } from '../../lib/prng';
import { SimplexNoise, createSimplexNoise } from '../../lib/noise';
import { dampParameter } from '../../lib/state';

export interface FlowFieldParams {
  seed: string;
  particleCount: number;
  speed: number;
  noiseScale: number;
  curlStrength: number;
  octaves: number;
  stepLength: number;
  trailDecay: number;
  colorPalette: 'aurora-cyan' | 'solar-amber' | 'phosphor-mint' | 'spectral-violet' | 'laser-crimson' | 'obsidian-mono';
  fieldEvolution?: number;
  mouseInfluence?: number;
}

export const DEFAULT_FLOW_FIELD_PARAMS: FlowFieldParams = {
  seed: '#A8F29D',
  particleCount: 5000,
  speed: 1.0,
  noiseScale: 0.003,
  curlStrength: 1.5,
  octaves: 3,
  stepLength: 2.0,
  trailDecay: 0.03,
  colorPalette: 'aurora-cyan',
  fieldEvolution: 0.25,
  mouseInfluence: 2.0,
};

// Curatorial Color Palette Definitions (RGBA components for fast canvas rendering)
interface PaletteColor {
  r: number;
  g: number;
  b: number;
}

const COLOR_PALETTES: Record<string, PaletteColor[]> = {
  'aurora-cyan': [
    { r: 0, g: 240, b: 255 },    // Electric Cyan (#00F0FF)
    { r: 0, g: 255, b: 157 },    // Phosphor Mint (#00FF9D)
    { r: 56, g: 189, b: 248 },   // Hydro Blue (#38BDF8)
    { r: 129, g: 140, b: 248 },  // Soft Indigo (#818CF8)
  ],
  'solar-amber': [
    { r: 255, g: 184, b: 0 },    // Solar Amber (#FFB800)
    { r: 255, g: 138, b: 0 },    // Radiant Orange (#FF8A00)
    { r: 245, g: 158, b: 11 },   // Deep Amber (#F59E0B)
    { r: 254, g: 224, b: 71 },   // Pale Solar (#FDE047)
  ],
  'phosphor-mint': [
    { r: 0, g: 255, b: 157 },    // Phosphor Mint (#00FF9D)
    { r: 16, g: 185, b: 129 },   // Emerald (#10B981)
    { r: 52, g: 211, b: 153 },   // Seafoam (#34D399)
    { r: 167, g: 243, b: 208 },  // Pale Mint (#A7F3D0)
  ],
  'spectral-violet': [
    { r: 168, g: 85, b: 247 },   // Spectral Violet (#A855F7)
    { r: 192, g: 132, b: 252 },  // Lavender (#C084FC)
    { r: 56, g: 189, b: 248 },   // Electric Blue (#38BDF8)
    { r: 236, g: 72, b: 153 },   // Magenta (#EC4899)
  ],
  'laser-crimson': [
    { r: 255, g: 51, b: 102 },   // Laser Crimson (#FF3366)
    { r: 244, g: 63, b: 94 },    // Rose (#F43F5E)
    { r: 251, g: 113, b: 133 },  // Coral (#FB7185)
    { r: 253, g: 164, b: 175 },  // Soft Rose (#FDA4AF)
  ],
  'obsidian-mono': [
    { r: 244, g: 246, b: 251 },  // Starlight White (#F4F6FB)
    { r: 203, g: 213, b: 225 },  // Pure Silver (#CBD5E1)
    { r: 148, g: 163, b: 184 },  // Slate (#94A3B8)
    { r: 100, g: 116, b: 139 },  // Steel (#64748B)
  ],
};

export class FlowFieldRoom implements RoomInstance {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private prng: PRNG = createPRNG('#A8F29D');
  private noise: SimplexNoise = createSimplexNoise('#A8F29D');

  private width = 0;
  private height = 0;
  private dpr = 1;
  private rafId: number | null = null;
  private lastTime = 0;
  private timeOffset = 0;

  // Active Simulation Parameters
  private params: FlowFieldParams = { ...DEFAULT_FLOW_FIELD_PARAMS };

  // Flat Typed Particle Storage Arrays (Pre-allocated for high cache locality)
  private maxCapacity = 25000;
  private activeCount = 5000;
  private posX = new Float32Array(this.maxCapacity);
  private posY = new Float32Array(this.maxCapacity);
  private prevX = new Float32Array(this.maxCapacity);
  private prevY = new Float32Array(this.maxCapacity);
  private vx = new Float32Array(this.maxCapacity);
  private vy = new Float32Array(this.maxCapacity);
  private life = new Float32Array(this.maxCapacity);
  private maxLife = new Float32Array(this.maxCapacity);
  private speedVariance = new Float32Array(this.maxCapacity);
  private colorBucket = new Uint8Array(this.maxCapacity);

  // Smooth pointer interaction state
  private pointerX = -1000;
  private pointerY = -1000;
  private smoothedPointerX = -1000;
  private smoothedPointerY = -1000;
  private isPointerDown = false;
  private pointerVelocity = 0;
  private lastPointerX = -1000;
  private lastPointerY = -1000;

  // Reduced motion preference flag
  private prefersReducedMotion = false;

  /**
   * Mounts the flow field simulation to the provided canvas and container.
   */
  public mount(ctx: RoomContext): RoomCleanupFn {
    this.canvas = ctx.canvas;
    this.ctx = ctx.canvas.getContext('2d', {
      alpha: false,
      desynchronized: true,
    });

    if (!this.ctx) {
      throw new Error('Failed to get 2D rendering context for Flow Field.');
    }

    this.dpr = ctx.dpr || 1;
    this.prng = ctx.prng || createPRNG(ctx.params.seed || DEFAULT_FLOW_FIELD_PARAMS.seed);
    this.noise = createSimplexNoise(this.prng);

    this.prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.applyParams(ctx.params, true);
    this.resize(this.canvas.width / this.dpr, this.canvas.height / this.dpr);

    // Initial background wipe to Obsidian void
    this.ctx.fillStyle = '#090A0D';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.lastTime = performance.now();
    this.loop = this.loop.bind(this);
    this.rafId = requestAnimationFrame(this.loop);

    return () => {
      this.teardown();
    };
  }

  /**
   * Called when simulation parameters change via Tweakpane or URL hash sync.
   */
  public updateParams(newParams: Record<string, any>): void {
    const prevSeed = this.params.seed;
    this.applyParams(newParams, false);

    // If seed changed, re-initialize PRNG, noise tables, and re-scatter particles
    if (newParams.seed && newParams.seed !== prevSeed) {
      this.prng = createPRNG(newParams.seed);
      this.noise.reseed(this.prng);
      this.reseedParticles();
    }
  }

  /**
   * Updates canvas dimensions and handles coordinate scaling.
   */
  public resize(width: number, height: number): void {
    this.width = Math.max(width, 100);
    this.height = Math.max(height, 100);

    if (this.canvas && this.ctx) {
      this.canvas.width = Math.floor(this.width * this.dpr);
      this.canvas.height = Math.floor(this.height * this.dpr);
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

      // Re-fill background on resize
      this.ctx.fillStyle = '#090A0D';
      this.ctx.fillRect(0, 0, this.width, this.height);
    }
  }

  /**
   * Receives normalized and pixel pointer events from the RoomViewer viewport controller.
   */
  public onPointer(event: RoomPointerEvent): void {
    if (event.type === 'leave') {
      this.pointerX = -1000;
      this.pointerY = -1000;
      this.isPointerDown = false;
      return;
    }

    this.pointerX = event.x;
    this.pointerY = event.y;
    this.isPointerDown = event.isDown;

    if (this.smoothedPointerX < -500) {
      this.smoothedPointerX = event.x;
      this.smoothedPointerY = event.y;
      this.lastPointerX = event.x;
      this.lastPointerY = event.y;
    }
  }

  /**
   * Merges and validates incoming parameter values.
   */
  private applyParams(incoming: Record<string, any>, isInitial: boolean): void {
    const count = Number(incoming.particleCount ?? this.params.particleCount);
    const newCount = Math.min(Math.max(Math.floor(count), 500), this.maxCapacity);

    this.params = {
      seed: String(incoming.seed ?? this.params.seed),
      particleCount: newCount,
      speed: Math.max(Number(incoming.speed ?? this.params.speed), 0.1),
      noiseScale: Math.max(Number(incoming.noiseScale ?? this.params.noiseScale), 0.0001),
      curlStrength: Math.max(Number(incoming.curlStrength ?? this.params.curlStrength), 0.1),
      octaves: Math.min(Math.max(Math.floor(Number(incoming.octaves ?? this.params.octaves)), 1), 5),
      stepLength: Math.max(Number(incoming.stepLength ?? this.params.stepLength), 0.1),
      trailDecay: Math.min(Math.max(Number(incoming.trailDecay ?? this.params.trailDecay), 0.001), 0.3),
      colorPalette: incoming.colorPalette && COLOR_PALETTES[incoming.colorPalette]
        ? incoming.colorPalette
        : this.params.colorPalette,
      fieldEvolution: Number(incoming.fieldEvolution ?? this.params.fieldEvolution ?? 0.25),
      mouseInfluence: Number(incoming.mouseInfluence ?? this.params.mouseInfluence ?? 2.0),
    };

    if (isInitial || newCount !== this.activeCount) {
      const oldCount = this.activeCount;
      this.activeCount = newCount;
      if (isInitial) {
        this.reseedParticles();
      } else if (newCount > oldCount) {
        // Initialize newly allocated particles
        for (let i = oldCount; i < newCount; i++) {
          this.initSingleParticle(i);
        }
      }
    }
  }

  /**
   * Seeds all active particles across the full simulation area.
   */
  private reseedParticles(): void {
    for (let i = 0; i < this.activeCount; i++) {
      this.initSingleParticle(i);
    }
  }

  /**
   * Initializes a single particle at index `i` with deterministic random properties.
   */
  private initSingleParticle(i: number): void {
    const x = this.prng.nextFloat(0, this.width || 800);
    const y = this.prng.nextFloat(0, this.height || 600);

    this.posX[i] = x;
    this.posY[i] = y;
    this.prevX[i] = x;
    this.prevY[i] = y;
    this.vx[i] = 0;
    this.vy[i] = 0;

    const maxL = this.prng.nextFloat(150, 450);
    this.life[i] = this.prng.nextFloat(20, maxL);
    this.maxLife[i] = maxL;
    this.speedVariance[i] = this.prng.nextFloat(0.65, 1.35);
    this.colorBucket[i] = this.prng.nextInt(0, 3);
  }

  /**
   * Resets particle position upon lifetime expiration or boundary escape without streak artifacts.
   */
  private respawnParticle(i: number): void {
    const x = this.prng.nextFloat(0, this.width);
    const y = this.prng.nextFloat(0, this.height);

    this.posX[i] = x;
    this.posY[i] = y;
    this.prevX[i] = x;
    this.prevY[i] = y;
    this.vx[i] = 0;
    this.vy[i] = 0;

    const maxL = this.prng.nextFloat(180, 480);
    this.life[i] = maxL;
    this.maxLife[i] = maxL;
    this.speedVariance[i] = this.prng.nextFloat(0.65, 1.35);
    this.colorBucket[i] = this.prng.nextInt(0, 3);
  }

  /**
   * Computes 2D Curl Noise vector at coordinate (x, y) with current field dynamics.
   */
  private computeFieldVelocity(x: number, y: number, t: number): { vx: number; vy: number } {
    const scale = this.params.noiseScale;
    const octaves = this.params.octaves;
    const curl = this.noise.curl2D(x * scale, y * scale, t, octaves, 0.006);

    const strength = this.params.curlStrength * 2.2;
    return {
      vx: curl.vx * strength,
      vy: curl.vy * strength,
    };
  }

  /**
   * Main 60 FPS animation loop.
   */
  private loop(currentTime: number): void {
    if (!this.ctx || !this.canvas) return;

    const dt = Math.min((currentTime - this.lastTime) / 1000, 0.05);
    this.lastTime = currentTime;

    const evolutionSpeed = (this.params.fieldEvolution ?? 0.25) * 0.15;
    this.timeOffset += dt * evolutionSpeed * (this.prefersReducedMotion ? 0.2 : 1.0);

    // Smooth pointer coordinate tracking
    if (this.pointerX > -500) {
      this.smoothedPointerX = dampParameter(this.smoothedPointerX, this.pointerX, 5.0, dt);
      this.smoothedPointerY = dampParameter(this.smoothedPointerY, this.pointerY, 5.0, dt);

      const pDeltaX = this.pointerX - this.lastPointerX;
      const pDeltaY = this.pointerY - this.lastPointerY;
      const curSpeed = Math.sqrt(pDeltaX * pDeltaX + pDeltaY * pDeltaY);
      this.pointerVelocity = dampParameter(this.pointerVelocity, curSpeed, 3.5, dt);

      this.lastPointerX = this.pointerX;
      this.lastPointerY = this.pointerY;
    } else {
      this.smoothedPointerX = dampParameter(this.smoothedPointerX, -1000, 2.0, dt);
      this.smoothedPointerY = dampParameter(this.smoothedPointerY, -1000, 2.0, dt);
      this.pointerVelocity = dampParameter(this.pointerVelocity, 0, 3.0, dt);
    }

    // 1. Semi-transparent clear overlay for fluid decaying trails over #090A0D
    const decay = this.params.trailDecay;
    this.ctx.fillStyle = `rgba(9, 10, 13, ${decay})`;
    this.ctx.fillRect(0, 0, this.width, this.height);

    // 2. Prepare color palette for batch rendering
    const palette = COLOR_PALETTES[this.params.colorPalette] || COLOR_PALETTES['aurora-cyan'];
    const numColors = palette.length;

    // 4 Path2D buckets for batched draw calls
    const pathBuckets: Path2D[] = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];

    const baseSpeed = this.params.speed * this.params.stepLength * 60;
    const mouseInfluence = (this.params.mouseInfluence ?? 2.0) * (this.isPointerDown ? 2.5 : 1.0);
    const motionScale = this.prefersReducedMotion ? 0.3 : 1.0;
    const padding = 20;

    // 3. Update & render particles
    for (let i = 0; i < this.activeCount; i++) {
      let px = this.posX[i];
      let py = this.posY[i];

      this.prevX[i] = px;
      this.prevY[i] = py;

      // Sample curl noise field
      const field = this.computeFieldVelocity(px, py, this.timeOffset);

      let targetVx = field.vx * baseSpeed * this.speedVariance[i] * motionScale;
      let targetVy = field.vy * baseSpeed * this.speedVariance[i] * motionScale;

      // Pointer vortex & displacement force
      if (this.smoothedPointerX > -500) {
        const dx = px - this.smoothedPointerX;
        const dy = py - this.smoothedPointerY;
        const distSq = dx * dx + dy * dy;
        const radius = 240;

        if (distSq < radius * radius && distSq > 1) {
          const dist = Math.sqrt(distSq);
          const force = (1 - dist / radius) * (18 + this.pointerVelocity * 1.2) * mouseInfluence;
          const normX = dx / dist;
          const normY = dy / dist;

          // Tangential vortex impulse + subtle outward swirl
          targetVx += (-normY * 1.1 + normX * 0.35) * force;
          targetVy += (normX * 1.1 + normY * 0.35) * force;
        }
      }

      // Smooth velocity integration
      this.vx[i] = dampParameter(this.vx[i], targetVx, 4.0, dt);
      this.vy[i] = dampParameter(this.vy[i], targetVy, 4.0, dt);

      px += this.vx[i] * dt;
      py += this.vy[i] * dt;

      this.posX[i] = px;
      this.posY[i] = py;

      // Decrement particle life
      this.life[i] -= dt * 60;

      // Boundary escape or life expiration check
      if (
        this.life[i] <= 0 ||
        px < -padding ||
        px > this.width + padding ||
        py < -padding ||
        py > this.height + padding
      ) {
        this.respawnParticle(i);
        continue;
      }

      // Add segment to appropriate color bucket
      // Direction-based color mapping for chromatic gradients along vortices
      const angle = Math.atan2(this.vy[i], this.vx[i]) + Math.PI; // [0, 2π]
      const bucketIdx = Math.floor((angle / (Math.PI * 2)) * numColors) % numColors;

      const path = pathBuckets[bucketIdx];
      path.moveTo(this.prevX[i], this.prevY[i]);
      path.lineTo(px, py);
    }

    // 4. Batch stroke paths per color bucket
    this.ctx.lineWidth = 1.2;
    this.ctx.lineCap = 'round';

    for (let c = 0; c < numColors; c++) {
      const color = palette[c];
      this.ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.75)`;
      this.ctx.stroke(pathBuckets[c]);
    }

    this.rafId = requestAnimationFrame(this.loop);
  }

  /**
   * Custom High-Resolution Offline Snapshot Capture Pass.
   * Runs an accumulated multi-step simulation on an off-screen canvas for museum-grade 4K/8K stills.
   */
  public async captureSnapshot(width: number, height: number): Promise<HTMLCanvasElement> {
    const offCanvas = document.createElement('canvas');
    offCanvas.width = width;
    offCanvas.height = height;

    const offCtx = offCanvas.getContext('2d', { alpha: false });
    if (!offCtx) {
      throw new Error('Failed to create offscreen context for Flow Field snapshot.');
    }

    // Fill background
    offCtx.fillStyle = '#090A0D';
    offCtx.fillRect(0, 0, width, height);

    const snapshotPrng = createPRNG(this.params.seed);
    const snapshotNoise = createSimplexNoise(snapshotPrng);

    const count = Math.min(this.params.particleCount * 2, 20000);
    const posX = new Float32Array(count);
    const posY = new Float32Array(count);
    const prevX = new Float32Array(count);
    const prevY = new Float32Array(count);
    const speedVar = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const x = snapshotPrng.nextFloat(0, width);
      const y = snapshotPrng.nextFloat(0, height);
      posX[i] = x;
      posY[i] = y;
      prevX[i] = x;
      prevY[i] = y;
      speedVar[i] = snapshotPrng.nextFloat(0.7, 1.3);
    }

    const palette = COLOR_PALETTES[this.params.colorPalette] || COLOR_PALETTES['aurora-cyan'];
    const numColors = palette.length;
    const baseSpeed = this.params.speed * this.params.stepLength * (width / this.width || 1);
    const scale = this.params.noiseScale * (this.width / width || 1);
    const octaves = this.params.octaves;
    const curlStrength = this.params.curlStrength * 2.2;

    const totalSteps = 80;
    const dt = 0.016;

    // Accumulate smooth particle filaments
    for (let step = 0; step < totalSteps; step++) {
      const t = step * 0.005;
      const paths: Path2D[] = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];

      for (let i = 0; i < count; i++) {
        prevX[i] = posX[i];
        prevY[i] = posY[i];

        const curl = snapshotNoise.curl2D(posX[i] * scale, posY[i] * scale, t, octaves, 0.006);
        const vx = curl.vx * curlStrength * baseSpeed * speedVar[i];
        const vy = curl.vy * curlStrength * baseSpeed * speedVar[i];

        posX[i] += vx * dt;
        posY[i] += vy * dt;

        if (posX[i] < 0 || posX[i] > width || posY[i] < 0 || posY[i] > height) {
          posX[i] = snapshotPrng.nextFloat(0, width);
          posY[i] = snapshotPrng.nextFloat(0, height);
          prevX[i] = posX[i];
          prevY[i] = posY[i];
          continue;
        }

        const angle = Math.atan2(vy, vx) + Math.PI;
        const bucket = Math.floor((angle / (Math.PI * 2)) * numColors) % numColors;

        paths[bucket].moveTo(prevX[i], prevY[i]);
        paths[bucket].lineTo(posX[i], posY[i]);
      }

      offCtx.lineWidth = 1.0;
      for (let c = 0; c < numColors; c++) {
        const color = palette[c];
        offCtx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.25)`;
        offCtx.stroke(paths[c]);
      }
    }

    return offCanvas;
  }

  /**
   * Tears down animation frame and releases references.
   */
  private teardown(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    this.canvas = null;
    this.ctx = null;
  }
}

/**
 * Convenience factory creating a FlowFieldRoom instance.
 */
export function createRoom(): FlowFieldRoom {
  return new FlowFieldRoom();
}

export const room = new FlowFieldRoom();
export default room;
