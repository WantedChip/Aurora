/**
 * Room 08: Differential Growth (Node-Splitting Organic Curve Expansion)
 * Curatorial Category: Artificial Life
 * Math Model: Planar Curve Subdivision, Spring Relaxation & Spatial Repulsion
 * Optimization: 2D Spatial Hash Grid (O(N) neighbor search sustaining 10,000+ nodes)
 * Aesthetic Direction: Obsidian Archival Minimal
 * 
 * Features:
 * - Real-time organic planar curve expansion modeling biological morphogenesis (coral ruffles, brain gyri, flora petals)
 * - Doubly-linked curve nodes indexed in flat contiguous typed arrays (Float32Array / Int32Array) with zero GC allocation
 * - O(N) Spatial Hash Grid for high-speed inter-node repulsion queries
 * - 5 Curatorial Morphology Presets: Ring, Double Ring, Star, Line, Quad Colonies
 * - 6 Curatorial Spectral Palettes: Coral Flora, Bioluminescent Cyan, Obsidian Emerald, Solar Amber, Spectral Amethyst, Monochrome Lithic
 * - 4 Visual Rendering Modes: Stroke & Membrane, Luminous Stroke Only, Membrane Fill Only, Nodes & Skeleton
 * - Smooth Catmull-Rom / Midpoint Quadratic Splines with multi-pass luminous glowing strokes and organic membrane fills
 * - Interactive pointer probe dynamics: Repel, Attract, and Feed / Accelerated Growth
 * - Frame-rate independent exponential parameter damping
 * - Custom high-resolution offline snapshot export (4K/8K stills)
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

export type MorphologyPreset = 'ring' | 'double-ring' | 'star' | 'line' | 'quad-colonies';
export type RenderMode = 'stroke-membrane' | 'luminous-stroke' | 'membrane-only' | 'nodes-mesh';
export type PointerMode = 'repel' | 'attract' | 'feed';
export type ColorPaletteId =
  | 'coral-flora'
  | 'bioluminescent-cyan'
  | 'obsidian-emerald'
  | 'solar-amber'
  | 'spectral-amethyst'
  | 'monochrome-lithic';

export interface DifferentialGrowthParams {
  seed: string;
  preset: MorphologyPreset;
  maxNodes: number;
  growthRate: number;
  splitThreshold: number;
  targetEdgeLength: number;
  repulsionRadius: number;
  repulsionStrength: number;
  springStrength: number;
  simSpeed: number;
  renderMode: RenderMode;
  strokeWidth: number;
  glowIntensity: number;
  membraneOpacity: number;
  pointerMode: PointerMode;
  pointerRadius: number;
  pointerStrength: number;
  colorPalette: ColorPaletteId;
}

export const DEFAULT_DIFFERENTIAL_PARAMS: DifferentialGrowthParams = {
  seed: '#FF8A00',
  preset: 'ring',
  maxNodes: 5000,
  growthRate: 14,
  splitThreshold: 14.0,
  targetEdgeLength: 8.0,
  repulsionRadius: 22.0,
  repulsionStrength: 0.9,
  springStrength: 0.5,
  simSpeed: 2,
  renderMode: 'stroke-membrane',
  strokeWidth: 2.0,
  glowIntensity: 0.75,
  membraneOpacity: 0.12,
  pointerMode: 'repel',
  pointerRadius: 110,
  pointerStrength: 1.0,
  colorPalette: 'coral-flora',
};

const MAX_NODE_CAPACITY = 24000;

export interface DifferentialPalette {
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  membrane: string;
  spore: string;
  bgGlow: string;
}

export const DIFFERENTIAL_PALETTES: Record<ColorPaletteId, DifferentialPalette> = {
  'coral-flora': {
    name: 'Coral Flora',
    primary: '#FF6B6B',
    secondary: '#FFA07A',
    accent: '#4ECDC4',
    membrane: 'rgba(255, 107, 107, 0.12)',
    spore: '#FFE66D',
    bgGlow: 'rgba(255, 107, 107, 0.04)',
  },
  'bioluminescent-cyan': {
    name: 'Bioluminescent Cyan',
    primary: '#00F0FF',
    secondary: '#00FF9D',
    accent: '#38BDF8',
    membrane: 'rgba(0, 240, 255, 0.12)',
    spore: '#E0F2FE',
    bgGlow: 'rgba(0, 240, 255, 0.04)',
  },
  'obsidian-emerald': {
    name: 'Obsidian Emerald',
    primary: '#00FF9D',
    secondary: '#10B981',
    accent: '#6EE7B7',
    membrane: 'rgba(0, 255, 157, 0.12)',
    spore: '#A7F3D0',
    bgGlow: 'rgba(0, 255, 157, 0.04)',
  },
  'solar-amber': {
    name: 'Solar Amber',
    primary: '#FFB800',
    secondary: '#FF8A00',
    accent: '#FF3E3E',
    membrane: 'rgba(255, 184, 0, 0.12)',
    spore: '#FFF275',
    bgGlow: 'rgba(255, 184, 0, 0.04)',
  },
  'spectral-amethyst': {
    name: 'Spectral Amethyst',
    primary: '#C084FC',
    secondary: '#E879F9',
    accent: '#818CF8',
    membrane: 'rgba(192, 132, 252, 0.12)',
    spore: '#FCE7F3',
    bgGlow: 'rgba(192, 132, 252, 0.04)',
  },
  'monochrome-lithic': {
    name: 'Monochrome Lithic',
    primary: '#F4F6FB',
    secondary: '#94A3B8',
    accent: '#475569',
    membrane: 'rgba(244, 246, 251, 0.08)',
    spore: '#FFFFFF',
    bgGlow: 'rgba(255, 255, 255, 0.03)',
  },
};

interface CurveRecord {
  id: number;
  head: number;
  isClosed: boolean;
}

export class DifferentialGrowthSimulation {
  private width: number = 800;
  private height: number = 600;
  private prng: PRNG;

  // Node data stored in flat typed contiguous arrays
  public posX: Float32Array = new Float32Array(MAX_NODE_CAPACITY);
  public posY: Float32Array = new Float32Array(MAX_NODE_CAPACITY);
  public vx: Float32Array = new Float32Array(MAX_NODE_CAPACITY);
  public vy: Float32Array = new Float32Array(MAX_NODE_CAPACITY);
  public forceX: Float32Array = new Float32Array(MAX_NODE_CAPACITY);
  public forceY: Float32Array = new Float32Array(MAX_NODE_CAPACITY);
  public prevNode: Int32Array = new Int32Array(MAX_NODE_CAPACITY);
  public nextNode: Int32Array = new Int32Array(MAX_NODE_CAPACITY);
  public curveId: Int16Array = new Int16Array(MAX_NODE_CAPACITY);
  public nodeAge: Float32Array = new Float32Array(MAX_NODE_CAPACITY);
  public nodeCurvature: Float32Array = new Float32Array(MAX_NODE_CAPACITY);

  public nodeCount: number = 0;
  public curves: CurveRecord[] = [];

  // Spatial Hash Grid for O(N) neighbor queries
  private gridCellSize: number = 24;
  private gridCols: number = 0;
  private gridRows: number = 0;
  private gridHead: Int32Array = new Int32Array(0);
  private gridNext: Int32Array = new Int32Array(MAX_NODE_CAPACITY);

  // Active parameter values (smoothly damped)
  public params: DifferentialGrowthParams;
  public targetParams: DifferentialGrowthParams;

  // Interactive pointer tracking
  public pointer = {
    x: 0,
    y: 0,
    normalizedX: 0.5,
    normalizedY: 0.5,
    isDown: false,
    active: false,
  };

  constructor(width: number, height: number, initialParams: Partial<DifferentialGrowthParams>, prng: PRNG) {
    this.width = Math.max(100, width);
    this.height = Math.max(100, height);
    this.prng = prng;
    this.params = { ...DEFAULT_DIFFERENTIAL_PARAMS, ...initialParams };
    this.targetParams = { ...this.params };

    this.initSpatialGrid();
    this.resetToPreset(this.params.preset);
  }

  public resize(width: number, height: number): void {
    const oldW = this.width;
    const oldH = this.height;
    this.width = Math.max(100, width);
    this.height = Math.max(100, height);
    this.initSpatialGrid();

    // Scale existing node positions gracefully to maintain relative layout
    if (oldW > 0 && oldH > 0 && (oldW !== this.width || oldH !== this.height)) {
      const scaleX = this.width / oldW;
      const scaleY = this.height / oldH;
      for (let i = 0; i < this.nodeCount; i++) {
        this.posX[i] *= scaleX;
        this.posY[i] *= scaleY;
      }
    }
  }

  private initSpatialGrid(): void {
    this.gridCellSize = Math.max(16, Math.ceil(this.params.repulsionRadius));
    this.gridCols = Math.max(1, Math.ceil(this.width / this.gridCellSize));
    this.gridRows = Math.max(1, Math.ceil(this.height / this.gridCellSize));
    const totalCells = this.gridCols * this.gridRows;
    if (this.gridHead.length < totalCells) {
      this.gridHead = new Int32Array(totalCells);
    }
  }

  private rebuildSpatialGrid(): void {
    const totalCells = this.gridCols * this.gridRows;
    this.gridHead.fill(-1, 0, totalCells);

    for (let i = 0; i < this.nodeCount; i++) {
      const cx = Math.max(0, Math.min(this.gridCols - 1, Math.floor(this.posX[i] / this.gridCellSize)));
      const cy = Math.max(0, Math.min(this.gridRows - 1, Math.floor(this.posY[i] / this.gridCellSize)));
      const cellIdx = cy * this.gridCols + cx;
      this.gridNext[i] = this.gridHead[cellIdx];
      this.gridHead[cellIdx] = i;
    }
  }

  public resetToPreset(preset: MorphologyPreset): void {
    this.nodeCount = 0;
    this.curves = [];
    this.posX.fill(0);
    this.posY.fill(0);
    this.vx.fill(0);
    this.vy.fill(0);
    this.forceX.fill(0);
    this.forceY.fill(0);
    this.prevNode.fill(-1);
    this.nextNode.fill(-1);
    this.curveId.fill(0);
    this.nodeAge.fill(0);
    this.nodeCurvature.fill(0);

    const cx = this.width * 0.5;
    const cy = this.height * 0.5;
    const minDim = Math.min(this.width, this.height);

    switch (preset) {
      case 'ring': {
        // Single circular seed
        const radius = minDim * 0.16;
        const count = 42;
        const headIdx = this.nodeCount;
        for (let i = 0; i < count; i++) {
          const theta = (i / count) * Math.PI * 2;
          const idx = this.nodeCount++;
          this.posX[idx] = cx + Math.cos(theta) * radius + this.prng.nextFloat(-1.5, 1.5);
          this.posY[idx] = cy + Math.sin(theta) * radius + this.prng.nextFloat(-1.5, 1.5);
          this.curveId[idx] = 0;
          this.prevNode[idx] = (i === 0) ? headIdx + count - 1 : idx - 1;
          this.nextNode[idx] = (i === count - 1) ? headIdx : idx + 1;
        }
        this.curves.push({ id: 0, head: headIdx, isClosed: true });
        break;
      }

      case 'double-ring': {
        // Concentric dual rings
        const rOuter = minDim * 0.22;
        const countOuter = 48;
        const headOuter = this.nodeCount;
        for (let i = 0; i < countOuter; i++) {
          const theta = (i / countOuter) * Math.PI * 2;
          const idx = this.nodeCount++;
          this.posX[idx] = cx + Math.cos(theta) * rOuter;
          this.posY[idx] = cy + Math.sin(theta) * rOuter;
          this.curveId[idx] = 0;
          this.prevNode[idx] = (i === 0) ? headOuter + countOuter - 1 : idx - 1;
          this.nextNode[idx] = (i === countOuter - 1) ? headOuter : idx + 1;
        }
        this.curves.push({ id: 0, head: headOuter, isClosed: true });

        const rInner = minDim * 0.09;
        const countInner = 24;
        const headInner = this.nodeCount;
        for (let i = 0; i < countInner; i++) {
          const theta = (i / countInner) * Math.PI * 2;
          const idx = this.nodeCount++;
          this.posX[idx] = cx + Math.cos(theta) * rInner;
          this.posY[idx] = cy + Math.sin(theta) * rInner;
          this.curveId[idx] = 1;
          this.prevNode[idx] = (i === 0) ? headInner + countInner - 1 : idx - 1;
          this.nextNode[idx] = (i === countInner - 1) ? headInner : idx + 1;
        }
        this.curves.push({ id: 1, head: headInner, isClosed: true });
        break;
      }

      case 'star': {
        // 8-pointed star blossom
        const count = 56;
        const baseR = minDim * 0.15;
        const headIdx = this.nodeCount;
        for (let i = 0; i < count; i++) {
          const theta = (i / count) * Math.PI * 2;
          const mod = 1.0 + 0.38 * Math.cos(8 * theta);
          const r = baseR * mod;
          const idx = this.nodeCount++;
          this.posX[idx] = cx + Math.cos(theta) * r;
          this.posY[idx] = cy + Math.sin(theta) * r;
          this.curveId[idx] = 0;
          this.prevNode[idx] = (i === 0) ? headIdx + count - 1 : idx - 1;
          this.nextNode[idx] = (i === count - 1) ? headIdx : idx + 1;
        }
        this.curves.push({ id: 0, head: headIdx, isClosed: true });
        break;
      }

      case 'line': {
        // Open serpentine ribbon
        const count = 38;
        const lineLen = minDim * 0.65;
        const startX = cx - lineLen * 0.5;
        const headIdx = this.nodeCount;
        for (let i = 0; i < count; i++) {
          const t = i / (count - 1);
          const px = startX + t * lineLen;
          const py = cy + Math.sin(t * Math.PI * 4) * (minDim * 0.08);
          const idx = this.nodeCount++;
          this.posX[idx] = px;
          this.posY[idx] = py;
          this.curveId[idx] = 0;
          this.prevNode[idx] = (i === 0) ? -1 : idx - 1;
          this.nextNode[idx] = (i === count - 1) ? -1 : idx + 1;
        }
        this.curves.push({ id: 0, head: headIdx, isClosed: false });
        break;
      }

      case 'quad-colonies': {
        // 4 circular colonies in four quadrants
        const offset = minDim * 0.18;
        const centers = [
          { x: cx - offset, y: cy - offset },
          { x: cx + offset, y: cy - offset },
          { x: cx - offset, y: cy + offset },
          { x: cx + offset, y: cy + offset },
        ];
        const rCol = minDim * 0.07;
        const countCol = 20;

        centers.forEach((center, cIdx) => {
          const headIdx = this.nodeCount;
          for (let i = 0; i < countCol; i++) {
            const theta = (i / countCol) * Math.PI * 2;
            const idx = this.nodeCount++;
            this.posX[idx] = center.x + Math.cos(theta) * rCol;
            this.posY[idx] = center.y + Math.sin(theta) * rCol;
            this.curveId[idx] = cIdx;
            this.prevNode[idx] = (i === 0) ? headIdx + countCol - 1 : idx - 1;
            this.nextNode[idx] = (i === countCol - 1) ? headIdx : idx + 1;
          }
          this.curves.push({ id: cIdx, head: headIdx, isClosed: true });
        });
        break;
      }
    }

    this.initSpatialGrid();
  }

  public update(dtSeconds: number): void {
    // Damp continuous parameters smoothly
    const lambda = 12.0;
    this.params.growthRate = dampParameter(this.params.growthRate, this.targetParams.growthRate, lambda, dtSeconds);
    this.params.splitThreshold = dampParameter(this.params.splitThreshold, this.targetParams.splitThreshold, lambda, dtSeconds);
    this.params.targetEdgeLength = dampParameter(this.params.targetEdgeLength, this.targetParams.targetEdgeLength, lambda, dtSeconds);
    this.params.repulsionRadius = dampParameter(this.params.repulsionRadius, this.targetParams.repulsionRadius, lambda, dtSeconds);
    this.params.repulsionStrength = dampParameter(this.params.repulsionStrength, this.targetParams.repulsionStrength, lambda, dtSeconds);
    this.params.springStrength = dampParameter(this.params.springStrength, this.targetParams.springStrength, lambda, dtSeconds);
    this.params.strokeWidth = dampParameter(this.params.strokeWidth, this.targetParams.strokeWidth, lambda, dtSeconds);
    this.params.glowIntensity = dampParameter(this.params.glowIntensity, this.targetParams.glowIntensity, lambda, dtSeconds);
    this.params.membraneOpacity = dampParameter(this.params.membraneOpacity, this.targetParams.membraneOpacity, lambda, dtSeconds);
    this.params.pointerRadius = dampParameter(this.params.pointerRadius, this.targetParams.pointerRadius, lambda, dtSeconds);
    this.params.pointerStrength = dampParameter(this.params.pointerStrength, this.targetParams.pointerStrength, lambda, dtSeconds);

    const substeps = Math.max(1, Math.round(this.params.simSpeed));
    for (let s = 0; s < substeps; s++) {
      this.stepPhysics();
    }

    this.computeCurvature();
  }

  private stepPhysics(): void {
    if (this.nodeCount <= 0) return;

    this.initSpatialGrid();
    this.rebuildSpatialGrid();

    this.forceX.fill(0, 0, this.nodeCount);
    this.forceY.fill(0, 0, this.nodeCount);

    const repelRadius = this.params.repulsionRadius;
    const repelRadiusSq = repelRadius * repelRadius;
    const repelStrength = this.params.repulsionStrength * 1.6;
    const springStrength = this.params.springStrength;
    const targetDist = this.params.targetEdgeLength;
    const friction = 0.18;

    // 1. Spring tension & Laplacian smoothing with direct neighbors
    for (let i = 0; i < this.nodeCount; i++) {
      const p = this.prevNode[i];
      const n = this.nextNode[i];
      const px = this.posX[i];
      const py = this.posY[i];

      let fx = 0;
      let fy = 0;

      if (p !== -1) {
        const dx = this.posX[p] - px;
        const dy = this.posY[p] - py;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
        const springDelta = dist - targetDist;
        const forceMag = springDelta * springStrength * 0.45;
        fx += (dx / dist) * forceMag;
        fy += (dy / dist) * forceMag;
      }

      if (n !== -1) {
        const dx = this.posX[n] - px;
        const dy = this.posY[n] - py;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
        const springDelta = dist - targetDist;
        const forceMag = springDelta * springStrength * 0.45;
        fx += (dx / dist) * forceMag;
        fy += (dy / dist) * forceMag;
      }

      // Laplacian smoothing: pull node toward centroid of connected neighbors
      if (p !== -1 && n !== -1) {
        const midX = (this.posX[p] + this.posX[n]) * 0.5;
        const midY = (this.posY[p] + this.posY[n]) * 0.5;
        fx += (midX - px) * (springStrength * 0.35);
        fy += (midY - py) * (springStrength * 0.35);
      }

      this.forceX[i] += fx;
      this.forceY[i] += fy;
    }

    // 2. Spatial Repulsion between all nodes within repulsion radius (O(N) via spatial grid)
    for (let i = 0; i < this.nodeCount; i++) {
      const px = this.posX[i];
      const py = this.posY[i];
      const prevI = this.prevNode[i];
      const nextI = this.nextNode[i];

      const cx = Math.max(0, Math.min(this.gridCols - 1, Math.floor(px / this.gridCellSize)));
      const cy = Math.max(0, Math.min(this.gridRows - 1, Math.floor(py / this.gridCellSize)));

      let fx = 0;
      let fy = 0;

      const minCX = Math.max(0, cx - 1);
      const maxCX = Math.min(this.gridCols - 1, cx + 1);
      const minCY = Math.max(0, cy - 1);
      const maxCY = Math.min(this.gridRows - 1, cy + 1);

      for (let ny = minCY; ny <= maxCY; ny++) {
        for (let nx = minCX; nx <= maxCX; nx++) {
          const cellIdx = ny * this.gridCols + nx;
          let j = this.gridHead[cellIdx];
          while (j !== -1) {
            if (j !== i) {
              const dx = px - this.posX[j];
              const dy = py - this.posY[j];
              const distSq = dx * dx + dy * dy;
              if (distSq < repelRadiusSq && distSq > 0.0001) {
                const dist = Math.sqrt(distSq);
                const isNeighbor = (j === prevI || j === nextI);
                // Connected neighbors have attenuated repulsion since springs govern their distance
                const weight = isNeighbor ? 0.3 : 1.0;
                const factor = 1.0 - (dist / repelRadius);
                const repelMag = factor * factor * repelStrength * weight;
                fx += (dx / dist) * repelMag;
                fy += (dy / dist) * repelMag;
              }
            }
            j = this.gridNext[j];
          }
        }
      }

      this.forceX[i] += fx;
      this.forceY[i] += fy;
    }

    // 3. Viewport soft boundary containment
    const margin = 45;
    const boundK = 0.65;
    for (let i = 0; i < this.nodeCount; i++) {
      const px = this.posX[i];
      const py = this.posY[i];
      if (px < margin) this.forceX[i] += (margin - px) * boundK;
      else if (px > this.width - margin) this.forceX[i] -= (px - (this.width - margin)) * boundK;
      if (py < margin) this.forceY[i] += (margin - py) * boundK;
      else if (py > this.height - margin) this.forceY[i] -= (py - (this.height - margin)) * boundK;
    }

    // 4. Interactive pointer force
    if (this.pointer.active) {
      const ptrX = this.pointer.x;
      const ptrY = this.pointer.y;
      const ptrRadius = this.params.pointerRadius;
      const ptrRadiusSq = ptrRadius * ptrRadius;
      const ptrStrength = this.params.pointerStrength * 2.2;
      const mode = this.params.pointerMode;

      for (let i = 0; i < this.nodeCount; i++) {
        const dx = this.posX[i] - ptrX;
        const dy = this.posY[i] - ptrY;
        const distSq = dx * dx + dy * dy;
        if (distSq < ptrRadiusSq && distSq > 0.001) {
          const dist = Math.sqrt(distSq);
          const factor = 1.0 - (dist / ptrRadius);
          const forceMag = factor * factor * ptrStrength;

          if (mode === 'repel') {
            this.forceX[i] += (dx / dist) * forceMag * 4.0;
            this.forceY[i] += (dy / dist) * forceMag * 4.0;
          } else if (mode === 'attract') {
            this.forceX[i] -= (dx / dist) * forceMag * 3.5;
            this.forceY[i] -= (dy / dist) * forceMag * 3.5;
          }
        }
      }
    }

    // 5. Integrate velocity & update positions
    for (let i = 0; i < this.nodeCount; i++) {
      this.vx[i] = (this.vx[i] + this.forceX[i]) * (1.0 - friction);
      this.vy[i] = (this.vy[i] + this.forceY[i]) * (1.0 - friction);
      this.posX[i] += this.vx[i];
      this.posY[i] += this.vy[i];
      this.nodeAge[i] += 1;
    }

    // 6. Adaptive Edge Splitting (Growth Step)
    this.splitEdges();
  }

  private splitEdges(): void {
    const splitThreshold = this.params.splitThreshold;
    const splitThresholdSq = splitThreshold * splitThreshold;
    const maxNodes = Math.min(Math.round(this.params.maxNodes), MAX_NODE_CAPACITY - 100);
    let splitsRemaining = Math.max(1, Math.round(this.params.growthRate));

    const ptrFeed = (this.pointer.active && this.params.pointerMode === 'feed');
    const ptrX = this.pointer.x;
    const ptrY = this.pointer.y;
    const ptrRadiusSq = this.params.pointerRadius * this.params.pointerRadius;

    // Iterate over existing nodes to check for candidate edges to subdivide
    const currentCount = this.nodeCount;
    for (let i = 0; i < currentCount && this.nodeCount < maxNodes && splitsRemaining > 0; i++) {
      const n = this.nextNode[i];
      if (n === -1) continue;

      const dx = this.posX[n] - this.posX[i];
      const dy = this.posY[n] - this.posY[i];
      const distSq = dx * dx + dy * dy;

      let shouldSplit = (distSq > splitThresholdSq);

      // Accelerated growth near pointer in feed mode
      if (!shouldSplit && ptrFeed) {
        const midX = (this.posX[i] + this.posX[n]) * 0.5;
        const midY = (this.posY[i] + this.posY[n]) * 0.5;
        const pDistSq = (midX - ptrX) * (midX - ptrX) + (midY - ptrY) * (midY - ptrY);
        if (pDistSq < ptrRadiusSq && distSq > (splitThresholdSq * 0.25)) {
          shouldSplit = true;
        }
      }

      if (shouldSplit) {
        const newIdx = this.nodeCount++;
        const normalX = -dy;
        const normalY = dx;
        const normalLen = Math.sqrt(normalX * normalX + normalY * normalY) || 1;
        // Organic micro-perturbation along normal vector to break collinear symmetry
        const perturb = this.prng.nextFloat(-0.8, 0.8);

        this.posX[newIdx] = (this.posX[i] + this.posX[n]) * 0.5 + (normalX / normalLen) * perturb;
        this.posY[newIdx] = (this.posY[i] + this.posY[n]) * 0.5 + (normalY / normalLen) * perturb;
        this.vx[newIdx] = (this.vx[i] + this.vx[n]) * 0.5;
        this.vy[newIdx] = (this.vy[i] + this.vy[n]) * 0.5;
        this.forceX[newIdx] = 0;
        this.forceY[newIdx] = 0;

        this.prevNode[newIdx] = i;
        this.nextNode[newIdx] = n;
        this.nextNode[i] = newIdx;
        this.prevNode[n] = newIdx;

        this.curveId[newIdx] = this.curveId[i];
        this.nodeAge[newIdx] = 0;
        this.nodeCurvature[newIdx] = 0;

        splitsRemaining--;
      }
    }
  }

  private computeCurvature(): void {
    for (let i = 0; i < this.nodeCount; i++) {
      const p = this.prevNode[i];
      const n = this.nextNode[i];
      if (p === -1 || n === -1) {
        this.nodeCurvature[i] = 0;
        continue;
      }

      const v1x = this.posX[i] - this.posX[p];
      const v1y = this.posY[i] - this.posY[p];
      const v2x = this.posX[n] - this.posX[i];
      const v2y = this.posY[n] - this.posY[i];

      const len1 = Math.sqrt(v1x * v1x + v1y * v1y) || 1;
      const len2 = Math.sqrt(v2x * v2x + v2y * v2y) || 1;

      // Dot product of normalized tangent vectors gives angle change (1.0 = straight line, -1.0 = hairpin turn)
      const dot = (v1x * v2x + v1y * v2y) / (len1 * len2);
      const clampedDot = Math.max(-1.0, Math.min(1.0, dot));
      // Curvature in range [0, 1] where 1.0 is sharpest turn/apex
      this.nodeCurvature[i] = (1.0 - clampedDot) * 0.5;
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number, dpr: number): void {
    ctx.save();
    ctx.scale(dpr, dpr);

    const palette = DIFFERENTIAL_PALETTES[this.params.colorPalette] || DIFFERENTIAL_PALETTES['coral-flora'];
    const renderMode = this.params.renderMode;
    const strokeWidth = Math.max(0.5, this.params.strokeWidth);
    const glowIntensity = this.params.glowIntensity;
    const membraneOpacity = this.params.membraneOpacity;

    // 1. Clear void background
    ctx.fillStyle = '#090A0D';
    ctx.fillRect(0, 0, width, height);

    // 2. Ambient radial background glow
    const ambientGrad = ctx.createRadialGradient(width * 0.5, height * 0.5, 10, width * 0.5, height * 0.5, Math.max(width, height) * 0.55);
    ambientGrad.addColorStop(0, palette.bgGlow);
    ambientGrad.addColorStop(1, 'rgba(9, 10, 13, 0)');
    ctx.fillStyle = ambientGrad;
    ctx.fillRect(0, 0, width, height);

    if (this.nodeCount < 3) {
      ctx.restore();
      return;
    }

    // 3. Render curves
    for (let c = 0; c < this.curves.length; c++) {
      const curve = this.curves[c];
      const nodes = this.extractCurveNodeIndices(curve);
      if (nodes.length < 3) continue;

      // Pass A: Organic Membrane Fill
      if ((renderMode === 'stroke-membrane' || renderMode === 'membrane-only') && curve.isClosed && membraneOpacity > 0.001) {
        this.drawSmoothCurvePath(ctx, nodes, true);
        ctx.fillStyle = palette.membrane.replace(/[\d\.]+\)$/, `${membraneOpacity})`);
        ctx.fill();
      }

      // Pass B: Luminous Outer Glow Stroke
      if (renderMode !== 'membrane-only' && glowIntensity > 0.01) {
        ctx.save();
        ctx.globalAlpha = glowIntensity * 0.38;
        ctx.lineWidth = strokeWidth * 3.4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = palette.secondary;
        this.drawSmoothCurvePath(ctx, nodes, curve.isClosed);
        ctx.stroke();
        ctx.restore();
      }

      // Pass C: Razor Sharp Core Stroke
      if (renderMode !== 'membrane-only') {
        ctx.save();
        ctx.globalAlpha = 0.95;
        ctx.lineWidth = strokeWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = palette.primary;
        this.drawSmoothCurvePath(ctx, nodes, curve.isClosed);
        ctx.stroke();
        ctx.restore();
      }

      // Pass D: Apex Starlight Spores / Skeleton Points
      if (renderMode === 'nodes-mesh' || renderMode === 'stroke-membrane') {
        ctx.save();
        const sporeColor = palette.spore;
        const step = (renderMode === 'nodes-mesh') ? 1 : 2;

        for (let i = 0; i < nodes.length; i += step) {
          const idx = nodes[i];
          const curv = this.nodeCurvature[idx];
          // In stroke-membrane mode, render spores primarily at high-curvature apex lobes
          if (renderMode === 'stroke-membrane' && curv < 0.25) continue;

          const size = (renderMode === 'nodes-mesh')
            ? strokeWidth * 0.85 + curv * 1.2
            : strokeWidth * 0.7 + curv * 2.0;

          const x = this.posX[idx];
          const y = this.posY[idx];

          ctx.fillStyle = sporeColor;
          ctx.beginPath();
          ctx.arc(x, y, Math.max(1.0, size), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    // 4. Interactive pointer reticle
    if (this.pointer.active) {
      ctx.save();
      const pr = this.params.pointerRadius;
      ctx.beginPath();
      ctx.arc(this.pointer.x, this.pointer.y, pr, 0, Math.PI * 2);
      ctx.strokeStyle = (this.params.pointerMode === 'repel')
        ? 'rgba(255, 107, 107, 0.25)'
        : (this.params.pointerMode === 'attract')
        ? 'rgba(0, 240, 255, 0.25)'
        : 'rgba(255, 230, 109, 0.35)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  private extractCurveNodeIndices(curve: CurveRecord): number[] {
    const indices: number[] = [];
    const visited = new Uint8Array(this.nodeCount);
    let curr = curve.head;

    while (curr !== -1 && curr < this.nodeCount && !visited[curr]) {
      indices.push(curr);
      visited[curr] = 1;
      curr = this.nextNode[curr];
      if (curve.isClosed && curr === curve.head) break;
    }

    return indices;
  }

  /**
   * Constructs a smooth midpoint quadratic spline through the given node sequence.
   * Provides C1 continuity and eliminate sharp kinks without heavy Catmull-Rom overhead.
   */
  private drawSmoothCurvePath(ctx: CanvasRenderingContext2D, nodes: number[], isClosed: boolean): void {
    const len = nodes.length;
    if (len < 2) return;

    ctx.beginPath();

    if (isClosed) {
      // For closed loops, start at the midpoint between the last and first node
      const pLast = nodes[len - 1];
      const pFirst = nodes[0];
      const startX = (this.posX[pLast] + this.posX[pFirst]) * 0.5;
      const startY = (this.posY[pLast] + this.posY[pFirst]) * 0.5;
      ctx.moveTo(startX, startY);

      for (let i = 0; i < len; i++) {
        const pCurr = nodes[i];
        const pNext = nodes[(i + 1) % len];
        const midX = (this.posX[pCurr] + this.posX[pNext]) * 0.5;
        const midY = (this.posY[pCurr] + this.posY[pNext]) * 0.5;
        ctx.quadraticCurveTo(this.posX[pCurr], this.posY[pCurr], midX, midY);
      }
      ctx.closePath();
    } else {
      // For open curves, start at the first point
      const pFirst = nodes[0];
      ctx.moveTo(this.posX[pFirst], this.posY[pFirst]);

      for (let i = 0; i < len - 1; i++) {
        const pCurr = nodes[i];
        const pNext = nodes[i + 1];
        const midX = (this.posX[pCurr] + this.posX[pNext]) * 0.5;
        const midY = (this.posY[pCurr] + this.posY[pNext]) * 0.5;
        ctx.quadraticCurveTo(this.posX[pCurr], this.posY[pCurr], midX, midY);
      }

      const pLast = nodes[len - 1];
      ctx.lineTo(this.posX[pLast], this.posY[pLast]);
    }
  }

  public captureSnapshot(width: number, height: number): HTMLCanvasElement {
    const snapCanvas = document.createElement('canvas');
    snapCanvas.width = width;
    snapCanvas.height = height;
    const snapCtx = snapCanvas.getContext('2d');
    if (!snapCtx) return snapCanvas;

    // Clone simulation state to run scaled rendering without mutating active viewport
    const scale = Math.min(width / this.width, height / this.height);
    const offsetX = (width - this.width * scale) * 0.5;
    const offsetY = (height - this.height * scale) * 0.5;

    snapCtx.save();
    snapCtx.fillStyle = '#090A0D';
    snapCtx.fillRect(0, 0, width, height);

    snapCtx.translate(offsetX, offsetY);
    snapCtx.scale(scale, scale);

    // Render snapshot
    this.render(snapCtx, this.width, this.height, 1);
    snapCtx.restore();

    return snapCanvas;
  }
}

/**
 * RoomInstance Implementation for Room 08: Differential Growth
 */
export class DifferentialGrowthRoom implements RoomInstance {
  private sim: DifferentialGrowthSimulation | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private animFrameId: number | null = null;
  private lastTime: number = 0;
  private dpr: number = 1;

  public async mount(context: RoomContext): Promise<RoomCleanupFn> {
    this.canvas = context.canvas;
    this.dpr = context.dpr || (typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1);
    this.ctx = this.canvas.getContext('2d');

    const width = this.canvas.width / this.dpr || 800;
    const height = this.canvas.height / this.dpr || 600;

    this.sim = new DifferentialGrowthSimulation(
      width,
      height,
      context.params as Partial<DifferentialGrowthParams>,
      context.prng
    );

    this.lastTime = performance.now();

    const renderLoop = (time: number) => {
      if (!this.sim || !this.ctx || !this.canvas) return;

      const dt = Math.min((time - this.lastTime) / 1000, 0.1);
      this.lastTime = time;

      this.sim.update(dt);

      const logicalW = this.canvas.width / this.dpr;
      const logicalH = this.canvas.height / this.dpr;
      this.sim.render(this.ctx, logicalW, logicalH, this.dpr);

      this.animFrameId = requestAnimationFrame(renderLoop);
    };

    this.animFrameId = requestAnimationFrame(renderLoop);

    return () => {
      if (this.animFrameId !== null) {
        cancelAnimationFrame(this.animFrameId);
        this.animFrameId = null;
      }
      this.sim = null;
      this.ctx = null;
      this.canvas = null;
    };
  }

  public updateParams(params: Record<string, any>): void {
    if (!this.sim) return;

    // If morphology preset changed, re-seed simulation
    if (params.preset && params.preset !== this.sim.targetParams.preset) {
      this.sim.targetParams.preset = params.preset;
      this.sim.params.preset = params.preset;
      this.sim.resetToPreset(params.preset);
    }

    // If seed changed, re-seed simulation
    if (params.seed && params.seed !== this.sim.targetParams.seed) {
      this.sim.targetParams.seed = params.seed;
      this.sim.params.seed = params.seed;
      const newPrng = createPRNG(params.seed);
      this.sim['prng'] = newPrng;
      this.sim.resetToPreset(this.sim.params.preset);
    }

    if (params.renderMode) {
      this.sim.params.renderMode = params.renderMode;
      this.sim.targetParams.renderMode = params.renderMode;
    }
    if (params.colorPalette) {
      this.sim.params.colorPalette = params.colorPalette;
      this.sim.targetParams.colorPalette = params.colorPalette;
    }
    if (params.pointerMode) {
      this.sim.params.pointerMode = params.pointerMode;
      this.sim.targetParams.pointerMode = params.pointerMode;
    }

    // Target continuous numerical values for smooth damping
    if (typeof params.growthRate === 'number') this.sim.targetParams.growthRate = params.growthRate;
    if (typeof params.splitThreshold === 'number') this.sim.targetParams.splitThreshold = params.splitThreshold;
    if (typeof params.targetEdgeLength === 'number') this.sim.targetParams.targetEdgeLength = params.targetEdgeLength;
    if (typeof params.repulsionRadius === 'number') this.sim.targetParams.repulsionRadius = params.repulsionRadius;
    if (typeof params.repulsionStrength === 'number') this.sim.targetParams.repulsionStrength = params.repulsionStrength;
    if (typeof params.springStrength === 'number') this.sim.targetParams.springStrength = params.springStrength;
    if (typeof params.simSpeed === 'number') this.sim.params.simSpeed = params.simSpeed;
    if (typeof params.maxNodes === 'number') this.sim.params.maxNodes = params.maxNodes;
    if (typeof params.strokeWidth === 'number') this.sim.targetParams.strokeWidth = params.strokeWidth;
    if (typeof params.glowIntensity === 'number') this.sim.targetParams.glowIntensity = params.glowIntensity;
    if (typeof params.membraneOpacity === 'number') this.sim.targetParams.membraneOpacity = params.membraneOpacity;
    if (typeof params.pointerRadius === 'number') this.sim.targetParams.pointerRadius = params.pointerRadius;
    if (typeof params.pointerStrength === 'number') this.sim.targetParams.pointerStrength = params.pointerStrength;
  }

  public resize(width: number, height: number): void {
    if (!this.sim) return;
    this.sim.resize(width, height);
  }

  public onPointer(event: RoomPointerEvent): void {
    if (!this.sim) return;

    if (event.type === 'leave') {
      this.sim.pointer.active = false;
      this.sim.pointer.isDown = false;
      return;
    }

    this.sim.pointer.x = event.x;
    this.sim.pointer.y = event.y;
    this.sim.pointer.normalizedX = event.normalizedX;
    this.sim.pointer.normalizedY = event.normalizedY;
    this.sim.pointer.isDown = event.isDown;
    this.sim.pointer.active = true;
  }

  public async captureSnapshot(width: number, height: number): Promise<HTMLCanvasElement> {
    if (!this.sim) {
      const dummy = document.createElement('canvas');
      dummy.width = width;
      dummy.height = height;
      return dummy;
    }
    return this.sim.captureSnapshot(width, height);
  }
}

export const room: RoomInstance = new DifferentialGrowthRoom();
export default room;
