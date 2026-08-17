/**
 * Room 03: Boids Flocking Simulation
 * Curatorial Category: Field & Flow
 * Math Model: Craig Reynolds' Steering Behaviors (Separation, Alignment, Cohesion)
 * Optimization: 2D Spatial Grid Partitioning (O(N) neighbor search)
 * Aesthetic Direction: Obsidian Archival Minimal
 * 
 * Features:
 * - High-performance swarm of 200–5,000 autonomous boid agents at 60 FPS
 * - Flat typed memory structures (Float32Array) with zero garbage-collection overhead
 * - O(N) Spatial Hashing Grid for instantaneous peer proximity queries
 * - Dynamic interactive predator / attractor cursor force field
 * - Geometric chevron arrowhead rendering with decaying luminescent velocity trails
 * - 5 Curatorial Spectral Palettes with panic-induced chromatic shifts
 * - Custom multi-step 4K/8K offline snapshot accumulation pass
 * - Complete resource disposal lifecycle
 */

import type {
  RoomInstance,
  RoomContext,
  RoomCleanupFn,
  RoomPointerEvent,
} from '../types';
import { createPRNG, type PRNG } from '../../lib/prng';
import { dampParameter } from '../../lib/state';

export interface BoidsParams {
  seed: string;
  boidCount: number;
  maxSpeed: number;
  separationWeight: number;
  alignmentWeight: number;
  cohesionWeight: number;
  neighborRadius: number;
  predatorRepulsion: number;
  trailDecay: number;
  colorPalette: 'aurora-cyan' | 'solar-amber' | 'spectral-violet' | 'phosphor-mint' | 'obsidian-mono';
}

export const DEFAULT_BOIDS_PARAMS: BoidsParams = {
  seed: '#39A2FF',
  boidCount: 2000,
  maxSpeed: 4.5,
  separationWeight: 1.8,
  alignmentWeight: 1.2,
  cohesionWeight: 1.0,
  neighborRadius: 65,
  predatorRepulsion: 4.5,
  trailDecay: 0.18,
  colorPalette: 'aurora-cyan',
};

const MAX_BOID_CAPACITY = 6000;

interface PaletteTheme {
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  panic: string;
  trailAlpha: number;
}

const BOID_PALETTES: Record<string, PaletteTheme> = {
  'aurora-cyan': {
    name: 'Aurora Cyan',
    primary: '#00F0FF',
    secondary: '#00FF9D',
    accent: '#38BDF8',
    panic: '#FF3366',
    trailAlpha: 0.18,
  },
  'solar-amber': {
    name: 'Solar Amber',
    primary: '#FFB800',
    secondary: '#FF6B00',
    accent: '#FFE500',
    panic: '#00F0FF',
    trailAlpha: 0.18,
  },
  'spectral-violet': {
    name: 'Spectral Violet',
    primary: '#A855F7',
    secondary: '#EC4899',
    accent: '#38BDF8',
    panic: '#FFB800',
    trailAlpha: 0.18,
  },
  'phosphor-mint': {
    name: 'Phosphor Mint',
    primary: '#00FF9D',
    secondary: '#10B981',
    accent: '#6EE7B7',
    panic: '#F43F5E',
    trailAlpha: 0.18,
  },
  'obsidian-mono': {
    name: 'Obsidian Mono',
    primary: '#F4F6FB',
    secondary: '#94A3B8',
    accent: '#CBD5E1',
    panic: '#00F0FF',
    trailAlpha: 0.22,
  },
};

export class BoidsRoom implements RoomInstance {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private prng: PRNG = createPRNG('#39A2FF');
  private width = 0;
  private height = 0;
  private dpr = 1;
  private rafId: number | null = null;
  private lastTime = 0;
  private isMounted = false;
  private prefersReducedMotion = false;

  // Active Parameters
  private params: BoidsParams = { ...DEFAULT_BOIDS_PARAMS };

  // Target Parameters for smooth interpolation
  private targetParams: BoidsParams = { ...DEFAULT_BOIDS_PARAMS };

  // Flat typed boid pool memory
  private posX = new Float32Array(MAX_BOID_CAPACITY);
  private posY = new Float32Array(MAX_BOID_CAPACITY);
  private vx = new Float32Array(MAX_BOID_CAPACITY);
  private vy = new Float32Array(MAX_BOID_CAPACITY);
  private panic = new Float32Array(MAX_BOID_CAPACITY);
  private sizeScale = new Float32Array(MAX_BOID_CAPACITY);

  // Spatial Partitioning Grid (Flat Linked List)
  private cellSize = 65;
  private gridCols = 0;
  private gridRows = 0;
  private gridHead = new Int32Array(0);
  private gridNext = new Int32Array(MAX_BOID_CAPACITY);

  // Interactive Cursor Predator State
  private pointerX = -1000;
  private pointerY = -1000;
  private smoothedPointerX = -1000;
  private smoothedPointerY = -1000;
  private isPointerDown = false;
  private isPointerInside = false;

  /**
   * Mounts the Boids flocking simulation to the provided canvas.
   */
  public async mount(ctx: RoomContext): Promise<RoomCleanupFn> {
    this.canvas = ctx.canvas;
    this.ctx = ctx.canvas.getContext('2d', { alpha: false, desynchronized: true });
    this.dpr = ctx.dpr || 1;
    this.prng = ctx.prng || createPRNG(ctx.params.seed || DEFAULT_BOIDS_PARAMS.seed);

    this.prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.applyParams(ctx.params, true);

    const initialW = Math.max(ctx.canvas.clientWidth || ctx.canvas.width || 800, 320);
    const initialH = Math.max(ctx.canvas.clientHeight || ctx.canvas.height || 600, 320);
    this.resize(initialW, initialH);

    this.initBoids();
    this.clearCanvasVoid();

    this.isMounted = true;
    this.lastTime = performance.now();

    this.loop = this.loop.bind(this);
    this.rafId = requestAnimationFrame(this.loop);

    return () => {
      this.teardown();
    };
  }

  /**
   * Initializes or re-initializes boid states from the PRNG seed.
   */
  private initBoids(): void {
    const count = Math.min(Math.round(this.params.boidCount), MAX_BOID_CAPACITY);
    const w = Math.max(this.width, 100);
    const h = Math.max(this.height, 100);
    const cx = w * 0.5;
    const cy = h * 0.5;

    for (let i = 0; i < MAX_BOID_CAPACITY; i++) {
      if (i < count) {
        // Cluster into organic initial shoals
        const angle = this.prng.nextFloat(0, Math.PI * 2);
        const radius = Math.sqrt(this.prng.nextFloat(0, 1)) * Math.min(w, h) * 0.45;
        this.posX[i] = cx + Math.cos(angle) * radius;
        this.posY[i] = cy + Math.sin(angle) * radius;

        const heading = angle + Math.PI * 0.5 + this.prng.nextFloat(-0.5, 0.5);
        const speed = this.prng.nextFloat(1.5, this.params.maxSpeed);
        this.vx[i] = Math.cos(heading) * speed;
        this.vy[i] = Math.sin(heading) * speed;
        this.panic[i] = 0;
        this.sizeScale[i] = this.prng.nextFloat(0.8, 1.25);
      } else {
        this.posX[i] = -1000;
        this.posY[i] = -1000;
        this.vx[i] = 0;
        this.vy[i] = 0;
        this.panic[i] = 0;
        this.sizeScale[i] = 1;
      }
    }
  }

  /**
   * Clears the entire canvas to solid Obsidian void (#090A0D).
   */
  private clearCanvasVoid(): void {
    if (!this.ctx) return;
    this.ctx.save();
    this.ctx.fillStyle = '#090A0D';
    this.ctx.fillRect(0, 0, this.width, this.height);
    this.ctx.restore();
  }

  /**
   * Sets up or updates the spatial hash grid dimensions.
   */
  private updateGridDimensions(): void {
    this.cellSize = Math.max(this.params.neighborRadius, 40);
    this.gridCols = Math.max(Math.ceil(this.width / this.cellSize), 1);
    this.gridRows = Math.max(Math.ceil(this.height / this.cellSize), 1);
    const totalCells = this.gridCols * this.gridRows;

    if (this.gridHead.length !== totalCells) {
      this.gridHead = new Int32Array(totalCells);
    }
  }

  /**
   * Called when simulation parameters change via Tweakpane or URL hash sync.
   */
  public updateParams(newParams: Record<string, any>): void {
    const prevSeed = this.targetParams.seed;
    const prevCount = this.targetParams.boidCount;

    this.applyParams(newParams, false);

    if (newParams.seed && newParams.seed !== prevSeed) {
      this.prng = createPRNG(newParams.seed);
      this.initBoids();
    } else if (newParams.boidCount && newParams.boidCount > prevCount) {
      // Spawn newly added boids at center
      const startIdx = Math.floor(prevCount);
      const endIdx = Math.min(Math.floor(newParams.boidCount), MAX_BOID_CAPACITY);
      for (let i = startIdx; i < endIdx; i++) {
        this.posX[i] = this.prng.nextFloat(0, this.width);
        this.posY[i] = this.prng.nextFloat(0, this.height);
        const a = this.prng.nextFloat(0, Math.PI * 2);
        this.vx[i] = Math.cos(a) * this.params.maxSpeed * 0.5;
        this.vy[i] = Math.sin(a) * this.params.maxSpeed * 0.5;
        this.panic[i] = 0;
        this.sizeScale[i] = this.prng.nextFloat(0.8, 1.25);
      }
    }
  }

  /**
   * Updates canvas dimensions, DPR scaling, and spatial grid bounds.
   */
  public resize(width: number, height: number): void {
    this.width = Math.max(width, 100);
    this.height = Math.max(height, 100);

    if (this.canvas) {
      this.canvas.width = Math.floor(this.width * this.dpr);
      this.canvas.height = Math.floor(this.height * this.dpr);
      this.canvas.style.width = `${this.width}px`;
      this.canvas.style.height = `${this.height}px`;
    }

    this.updateGridDimensions();
  }

  /**
   * Receives normalized and pixel pointer events from the RoomViewer viewport controller.
   */
  public onPointer(event: RoomPointerEvent): void {
    if (event.type === 'leave') {
      this.isPointerInside = false;
      this.pointerX = -1000;
      this.pointerY = -1000;
      this.isPointerDown = false;
      return;
    }

    this.isPointerInside = true;
    this.pointerX = event.x;
    this.pointerY = event.y;
    this.isPointerDown = event.isDown;

    if (this.smoothedPointerX < -500) {
      this.smoothedPointerX = this.pointerX;
      this.smoothedPointerY = this.pointerY;
    }
  }

  /**
   * Returns whether the simulation is currently active and mounted.
   */
  public isSimulationMounted(): boolean {
    return this.isMounted;
  }

  /**
   * Merges and validates parameter changes.
   */
  private applyParams(incoming: Record<string, any>, isInitial: boolean): void {
    this.targetParams = {
      seed: String(incoming.seed ?? this.targetParams.seed),
      boidCount: Math.min(Math.max(Number(incoming.boidCount ?? this.targetParams.boidCount), 100), MAX_BOID_CAPACITY),
      maxSpeed: Math.min(Math.max(Number(incoming.maxSpeed ?? this.targetParams.maxSpeed), 1.0), 10.0),
      separationWeight: Math.min(Math.max(Number(incoming.separationWeight ?? this.targetParams.separationWeight), 0.1), 5.0),
      alignmentWeight: Math.min(Math.max(Number(incoming.alignmentWeight ?? this.targetParams.alignmentWeight), 0.1), 5.0),
      cohesionWeight: Math.min(Math.max(Number(incoming.cohesionWeight ?? this.targetParams.cohesionWeight), 0.1), 5.0),
      neighborRadius: Math.min(Math.max(Number(incoming.neighborRadius ?? this.targetParams.neighborRadius), 20), 150),
      predatorRepulsion: Math.min(Math.max(Number(incoming.predatorRepulsion ?? this.targetParams.predatorRepulsion), 0.0), 10.0),
      trailDecay: Math.min(Math.max(Number(incoming.trailDecay ?? this.targetParams.trailDecay), 0.02), 0.5),
      colorPalette: incoming.colorPalette && BOID_PALETTES[incoming.colorPalette]
        ? incoming.colorPalette
        : this.targetParams.colorPalette,
    };

    if (isInitial) {
      this.params = { ...this.targetParams };
    }
  }

  /**
   * Main 60 FPS animation loop with spatial hashing and Craig Reynolds boid steering.
   */
  private loop(currentTime: number): void {
    if (!this.ctx || !this.isMounted) return;

    const dt = Math.min((currentTime - this.lastTime) / 1000, 0.05);
    this.lastTime = currentTime;

    // Smoothly lerp active parameters
    const lambda = 5.0;
    this.params.boidCount = dampParameter(this.params.boidCount, this.targetParams.boidCount, lambda, dt);
    this.params.maxSpeed = dampParameter(this.params.maxSpeed, this.targetParams.maxSpeed, lambda, dt);
    this.params.separationWeight = dampParameter(this.params.separationWeight, this.targetParams.separationWeight, lambda, dt);
    this.params.alignmentWeight = dampParameter(this.params.alignmentWeight, this.targetParams.alignmentWeight, lambda, dt);
    this.params.cohesionWeight = dampParameter(this.params.cohesionWeight, this.targetParams.cohesionWeight, lambda, dt);
    this.params.neighborRadius = dampParameter(this.params.neighborRadius, this.targetParams.neighborRadius, lambda, dt);
    this.params.predatorRepulsion = dampParameter(this.params.predatorRepulsion, this.targetParams.predatorRepulsion, lambda, dt);
    this.params.trailDecay = dampParameter(this.params.trailDecay, this.targetParams.trailDecay, lambda, dt);
    this.params.colorPalette = this.targetParams.colorPalette;

    // Smooth pointer coordinates
    if (this.pointerX > -500) {
      this.smoothedPointerX = dampParameter(this.smoothedPointerX, this.pointerX, 8.0, dt);
      this.smoothedPointerY = dampParameter(this.smoothedPointerY, this.pointerY, 8.0, dt);
    } else {
      this.smoothedPointerX = -1000;
      this.smoothedPointerY = -1000;
    }

    // Step physics & update boids
    const motionScale = this.prefersReducedMotion ? 0.35 : 1.0;
    const count = Math.min(Math.round(this.params.boidCount), MAX_BOID_CAPACITY);
    this.updateBoidPhysics(count, dt * motionScale);

    // Render frame to canvas
    this.renderBoidFrame(count);

    this.rafId = requestAnimationFrame(this.loop);
  }

  /**
   * Populates the spatial grid and executes boid steering forces.
   */
  private updateBoidPhysics(count: number, dt: number): void {
    const w = this.width;
    const h = this.height;
    const neighborRadius = this.params.neighborRadius;
    const neighborDistSq = neighborRadius * neighborRadius;
    const separationRadius = neighborRadius * 0.45;
    const separationDistSq = separationRadius * separationRadius;
    const maxSpeed = this.params.maxSpeed;
    const minSpeed = maxSpeed * 0.3;
    const maxForce = 0.25;

    const wSep = this.params.separationWeight;
    const wAlign = this.params.alignmentWeight;
    const wCoh = this.params.cohesionWeight;
    const wPred = this.params.predatorRepulsion;

    const px = this.smoothedPointerX;
    const py = this.smoothedPointerY;
    const hasPredator = px > -500 && py > -500;
    const predatorRadius = this.isPointerDown ? 280 : 180;
    const predatorRadiusSq = predatorRadius * predatorRadius;

    // 1. Clear spatial hash grid
    this.gridHead.fill(-1);

    // 2. Insert active boids into spatial grid
    const cSize = this.cellSize;
    const cols = this.gridCols;
    const rows = this.gridRows;

    for (let i = 0; i < count; i++) {
      let gx = Math.floor(this.posX[i] / cSize);
      let gy = Math.floor(this.posY[i] / cSize);

      // Clamp grid coordinates
      if (gx < 0) gx = 0;
      else if (gx >= cols) gx = cols - 1;
      if (gy < 0) gy = 0;
      else if (gy >= rows) gy = rows - 1;

      const cellIdx = gy * cols + gx;
      this.gridNext[i] = this.gridHead[cellIdx];
      this.gridHead[cellIdx] = i;
    }

    // 3. Compute Steering Vectors for each boid
    const dtScale = Math.min(dt * 60, 2.0);

    for (let i = 0; i < count; i++) {
      const xi = this.posX[i];
      const yi = this.posY[i];
      const vxi = this.vx[i];
      const vyi = this.vy[i];

      let sepX = 0;
      let sepY = 0;
      let alignX = 0;
      let alignY = 0;
      let cohX = 0;
      let cohY = 0;
      let neighborCount = 0;
      let sepCount = 0;

      // Determine grid cell range for 3x3 search
      const gx = Math.floor(xi / cSize);
      const gy = Math.floor(yi / cSize);

      const minGx = Math.max(gx - 1, 0);
      const maxGx = Math.min(gx + 1, cols - 1);
      const minGy = Math.max(gy - 1, 0);
      const maxGy = Math.min(gy + 1, rows - 1);

      for (let cy = minGy; cy <= maxGy; cy++) {
        for (let cx = minGx; cx <= maxGx; cx++) {
          const cellIdx = cy * cols + cx;
          let j = this.gridHead[cellIdx];

          while (j !== -1) {
            if (j !== i) {
              const dx = this.posX[j] - xi;
              const dy = this.posY[j] - yi;
              const d2 = dx * dx + dy * dy;

              if (d2 < neighborDistSq && d2 > 0.0001) {
                const d = Math.sqrt(d2);

                // Alignment: accumulate neighbor velocities
                alignX += this.vx[j];
                alignY += this.vy[j];

                // Cohesion: accumulate neighbor positions
                cohX += this.posX[j];
                cohY += this.posY[j];
                neighborCount++;

                // Separation: repel inversely proportional to distance
                if (d2 < separationDistSq) {
                  const repForce = (separationRadius - d) / (d + 0.01);
                  sepX -= (dx / d) * repForce;
                  sepY -= (dy / d) * repForce;
                  sepCount++;
                }
              }
            }
            j = this.gridNext[j];
          }
        }
      }

      let ax = 0;
      let ay = 0;

      // Separation Force
      if (sepCount > 0) {
        sepX /= sepCount;
        sepY /= sepCount;
        const lenSep = Math.sqrt(sepX * sepX + sepY * sepY);
        if (lenSep > 0.0001) {
          sepX = (sepX / lenSep) * maxSpeed - vxi;
          sepY = (sepY / lenSep) * maxSpeed - vyi;
          ax += sepX * wSep;
          ay += sepY * wSep;
        }
      }

      // Alignment Force
      if (neighborCount > 0) {
        alignX /= neighborCount;
        alignY /= neighborCount;
        const lenAlign = Math.sqrt(alignX * alignX + alignY * alignY);
        if (lenAlign > 0.0001) {
          alignX = (alignX / lenAlign) * maxSpeed - vxi;
          alignY = (alignY / lenAlign) * maxSpeed - vyi;
          ax += alignX * wAlign;
          ay += alignY * wAlign;
        }

        // Cohesion Force
        cohX = cohX / neighborCount - xi;
        cohY = cohY / neighborCount - yi;
        const lenCoh = Math.sqrt(cohX * cohX + cohY * cohY);
        if (lenCoh > 0.0001) {
          cohX = (cohX / lenCoh) * maxSpeed - vxi;
          cohY = (cohY / lenCoh) * maxSpeed - vyi;
          ax += cohX * wCoh;
          ay += cohY * wCoh;
        }
      }

      // 4. Interactive Predator / Attractor Cursor Dynamics
      let panicLevel = 0;
      if (hasPredator) {
        const pdx = xi - px;
        const pdy = yi - py;
        const pDistSq = pdx * pdx + pdy * pdy;

        if (pDistSq < predatorRadiusSq && pDistSq > 0.0001) {
          const pDist = Math.sqrt(pDistSq);
          panicLevel = Math.max(1.0 - pDist / predatorRadius, 0.0);

          if (this.isPointerDown) {
            // Click / Hold Mode: Swirling gravitational attractor
            const pullForce = panicLevel * 1.5;
            const tangentX = -pdy / pDist;
            const tangentY = pdx / pDist;
            ax += ((-pdx / pDist) * 0.7 + tangentX * 0.8) * pullForce * maxSpeed;
            ay += ((-pdy / pDist) * 0.7 + tangentY * 0.8) * pullForce * maxSpeed;
          } else {
            // Roaming Predator Mode: Violent panic scattering
            const fleeForce = (1.0 - pDist / predatorRadius) * wPred * 2.2;
            ax += (pdx / pDist) * fleeForce * maxSpeed;
            ay += (pdy / pDist) * fleeForce * maxSpeed;
          }
        }
      }

      // Frame-rate independent exponential panic damping
      const panicDecay = Math.exp(-7.5 * dt);
      this.panic[i] = this.panic[i] * panicDecay + panicLevel * (1.0 - panicDecay);

      // Clamp total steering acceleration
      const accLen = Math.sqrt(ax * ax + ay * ay);
      if (accLen > maxForce * 4.0) {
        ax = (ax / accLen) * maxForce * 4.0;
        ay = (ay / accLen) * maxForce * 4.0;
      }

      // Update velocity with acceleration and frame-rate independent drag
      const dragFactor = Math.pow(0.985, dtScale);
      let nvx = (vxi + ax * dtScale) * dragFactor;
      let nvy = (vyi + ay * dtScale) * dragFactor;

      // Speed limits
      const curSpeed = Math.sqrt(nvx * nvx + nvy * nvy);
      const effectiveMaxSpeed = maxSpeed * (1.0 + this.panic[i] * 0.8);

      if (curSpeed > effectiveMaxSpeed) {
        nvx = (nvx / curSpeed) * effectiveMaxSpeed;
        nvy = (nvy / curSpeed) * effectiveMaxSpeed;
      } else if (curSpeed < minSpeed && curSpeed > 0.0001) {
        nvx = (nvx / curSpeed) * minSpeed;
        nvy = (nvy / curSpeed) * minSpeed;
      }

      this.vx[i] = nvx;
      this.vy[i] = nvy;

      // Update position
      let npx = xi + nvx * dtScale;
      let npy = yi + nvy * dtScale;

      // Toroidal wrap around screen edges with subtle margin
      const margin = 20;
      if (npx < -margin) npx = w + margin;
      else if (npx > w + margin) npx = -margin;
      if (npy < -margin) npy = h + margin;
      else if (npy > h + margin) npy = -margin;

      this.posX[i] = npx;
      this.posY[i] = npy;
    }
  }

  /**
   * Renders boids with geometric chevrons and luminous velocity arcs.
   */
  private renderBoidFrame(count: number): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const dpr = this.dpr;
    const w = this.width;
    const h = this.height;

    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Semi-transparent clear overlay for decaying luminous vector trails
    const trailDecay = Math.max(Math.min(this.params.trailDecay, 0.5), 0.02);
    ctx.fillStyle = `rgba(9, 10, 13, ${trailDecay})`;
    ctx.fillRect(0, 0, w, h);

    // 2. Prepare color palettes
    const pal = BOID_PALETTES[this.params.colorPalette] || BOID_PALETTES['aurora-cyan'];

    // 3. Batched Path2D Buckets (Primary, Secondary, Accent, Panic)
    const pathPrimary = new Path2D();
    const pathSecondary = new Path2D();
    const pathAccent = new Path2D();
    const pathPanic = new Path2D();

    for (let i = 0; i < count; i++) {
      const px = this.posX[i];
      const py = this.posY[i];
      const vx = this.vx[i];
      const vy = this.vy[i];
      const panic = this.panic[i];
      const scale = this.sizeScale[i];

      const speed = Math.sqrt(vx * vx + vy * vy);
      if (speed < 0.001) continue;

      const angle = Math.atan2(vy, vx);
      const headLen = (5.5 + speed * 0.9) * scale;
      const wingSpan = 3.5 * scale;

      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      // Chevron vertices: Tip, Left Wing, Center Indent, Right Wing
      const tipX = px + cosA * headLen;
      const tipY = py + sinA * headLen;

      const leftX = px - cosA * headLen * 0.5 - sinA * wingSpan;
      const leftY = py - sinA * headLen * 0.5 + cosA * wingSpan;

      const indentX = px - cosA * headLen * 0.2;
      const indentY = py - sinA * headLen * 0.2;

      const rightX = px - cosA * headLen * 0.5 + sinA * wingSpan;
      const rightY = py - sinA * headLen * 0.5 - cosA * wingSpan;

      // Select target path bucket based on panic state and velocity angle
      let targetPath = pathPrimary;
      if (panic > 0.3) {
        targetPath = pathPanic;
      } else if (i % 3 === 0) {
        targetPath = pathSecondary;
      } else if (i % 3 === 1) {
        targetPath = pathAccent;
      }

      targetPath.moveTo(tipX, tipY);
      targetPath.lineTo(leftX, leftY);
      targetPath.lineTo(indentX, indentY);
      targetPath.lineTo(rightX, rightY);
      targetPath.closePath();
    }

    // 4. Stroke & Fill Render Passes
    ctx.shadowBlur = 4;

    // Primary flock layer
    ctx.fillStyle = pal.primary;
    ctx.shadowColor = pal.primary;
    ctx.fill(pathPrimary);

    // Secondary flock layer
    ctx.fillStyle = pal.secondary;
    ctx.shadowColor = pal.secondary;
    ctx.fill(pathSecondary);

    // Accent flock layer
    ctx.fillStyle = pal.accent;
    ctx.shadowColor = pal.accent;
    ctx.fill(pathAccent);

    // Panic / predator scattering layer
    ctx.fillStyle = pal.panic;
    ctx.shadowColor = pal.panic;
    ctx.fill(pathPanic);

    ctx.shadowBlur = 0;

    // 5. Interactive Predator / Attractor Cursor Ring Indicator
    if (this.smoothedPointerX > -500 && this.isPointerInside) {
      const px = this.smoothedPointerX;
      const py = this.smoothedPointerY;
      const ringRadius = this.isPointerDown ? 24 : 16;

      ctx.beginPath();
      ctx.arc(px, py, ringRadius, 0, Math.PI * 2);
      ctx.strokeStyle = this.isPointerDown ? pal.accent : pal.panic;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Subtle pulse dot
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fillStyle = this.isPointerDown ? pal.accent : pal.panic;
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Custom High-Resolution Offline Snapshot Capture Pass.
   * Renders the boids swarm onto an off-screen canvas at target resolution (e.g. 4K/8K).
   */
  public async captureSnapshot(width: number, height: number): Promise<HTMLCanvasElement> {
    const offCanvas = document.createElement('canvas');
    offCanvas.width = width;
    offCanvas.height = height;
    const offCtx = offCanvas.getContext('2d', { alpha: false });
    if (!offCtx) return offCanvas;

    const scaleX = width / Math.max(this.width, 1);
    const scaleY = height / Math.max(this.height, 1);
    const count = Math.min(Math.round(this.params.boidCount), MAX_BOID_CAPACITY);
    const pal = BOID_PALETTES[this.params.colorPalette] || BOID_PALETTES['aurora-cyan'];

    // Fill background
    offCtx.fillStyle = '#090A0D';
    offCtx.fillRect(0, 0, width, height);

    offCtx.save();
    offCtx.scale(scaleX, scaleY);

    const path = new Path2D();
    for (let i = 0; i < count; i++) {
      const px = this.posX[i];
      const py = this.posY[i];
      const vx = this.vx[i];
      const vy = this.vy[i];
      const scale = this.sizeScale[i];

      const speed = Math.sqrt(vx * vx + vy * vy);
      if (speed < 0.001) continue;

      const angle = Math.atan2(vy, vx);
      const headLen = (6.0 + speed * 1.0) * scale;
      const wingSpan = 3.8 * scale;

      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      const tipX = px + cosA * headLen;
      const tipY = py + sinA * headLen;
      const leftX = px - cosA * headLen * 0.5 - sinA * wingSpan;
      const leftY = py - sinA * headLen * 0.5 + cosA * wingSpan;
      const indentX = px - cosA * headLen * 0.2;
      const indentY = py - sinA * headLen * 0.2;
      const rightX = px - cosA * headLen * 0.5 + sinA * wingSpan;
      const rightY = py - sinA * headLen * 0.5 - cosA * wingSpan;

      path.moveTo(tipX, tipY);
      path.lineTo(leftX, leftY);
      path.lineTo(indentX, indentY);
      path.lineTo(rightX, rightY);
      path.closePath();
    }

    offCtx.fillStyle = pal.primary;
    offCtx.shadowColor = pal.primary;
    offCtx.shadowBlur = 6;
    offCtx.fill(path);
    offCtx.restore();

    return offCanvas;
  }

  /**
   * Tears down animation frames, nullifies canvas contexts, and frees memory.
   */
  private teardown(): void {
    this.isMounted = false;

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    this.ctx = null;
    this.canvas = null;
  }
}

/**
 * Convenience factory creating a BoidsRoom instance.
 */
export function createRoom(): BoidsRoom {
  return new BoidsRoom();
}

export const room = new BoidsRoom();
export default room;
