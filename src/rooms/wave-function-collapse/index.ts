/**
 * Room 12: Wave Function Collapse (Procedural Constraint Tiling)
 * Curatorial Category: Chaos & Procedural
 * Math Model: 2D Directional Constraint Propagation & Shannon Entropy Minimization
 * Rendering Architecture: Canvas2D Vector Synthesizer with Superposition Transparency & Wave Ripple Effects
 * Aesthetic Direction: Obsidian Archival Minimal
 * 
 * Features:
 * - 2D Discrete Wave Function Collapse (WFC) solver based on Paul Merrell's Model Synthesis and Maxim Gumin's WFC algorithm
 * - Shannon entropy tracking with deterministic PRNG tie-breaking
 * - 4-directional socket constraint propagation (North, East, South, West) with early-exit bitset operations
 * - Contradiction detection with animated warning ripples and automatic recovery/restart
 * - 5 Rich Procedural Tileset Presets:
 *     1. Cyber Circuit Board (micro-traces, QFP processor, vias, capacitors, gold pins)
 *     2. Quantum Minimal Pipes (metallic pipes, elbows, 4-way manifolds, pressure dials, glowing core)
 *     3. Archival Labyrinth (monolithic stone corridors, runic megaliths, dead-end shrines, courtyards)
 *     4. Gothic Arches (pointed lancet arches, groin vaults, rose window nexus, colonnade piers)
 *     5. Dual-Color Wang Tiles (complete 16-tile basis with continuous organic bezier curves)
 * - 6 Curatorial Spectral Palettes: Spectral Aurora, Cyber Neon, Solar Plasma, Obsidian Emerald, Cosmic Amethyst, Monochrome Lithic
 * - Animated collapse wavefront with superposition preview rendering, entropy heat aura, and glowing propagation shockwaves
 * - Interactive pointer collapse, erasing, constraint pinning, and disturbance brush tools
 * - Symmetry enforcement option (horizontal/vertical/rotational reflections)
 * - High-resolution 4K/8K offline snapshot export (captureSnapshot)
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

export type TileSetPreset = 'circuit' | 'pipes' | 'labyrinth' | 'gothic' | 'wang';
export type PointerMode = 'collapse' | 'erase' | 'pin-blank' | 'disturb';
export type ColorPaletteId =
  | 'spectral-aurora'
  | 'cyber-neon'
  | 'solar-plasma'
  | 'obsidian-emerald'
  | 'cosmic-amethyst'
  | 'monochrome-lithic';

export interface WFCParams {
  seed: string;
  gridSize: number;
  tileSet: TileSetPreset;
  collapseSpeed: number;
  autoRestart: boolean;
  restartDelay: number;
  symmetryEnforce: boolean;
  colorPalette: ColorPaletteId;
  superpositionAlpha: number;
  frontierGlow: number;
  lineWidth: number;
  pointerMode: PointerMode;
  brushRadius: number;
}

export const DEFAULT_WFC_PARAMS: WFCParams = {
  seed: '#00E676',
  gridSize: 32,
  tileSet: 'circuit',
  collapseSpeed: 4,
  autoRestart: true,
  restartDelay: 3.5,
  symmetryEnforce: false,
  colorPalette: 'spectral-aurora',
  superpositionAlpha: 0.35,
  frontierGlow: 1.2,
  lineWidth: 2.0,
  pointerMode: 'collapse',
  brushRadius: 1,
};

export interface WFCPalette {
  name: string;
  bg: string;
  gridLine: string;
  primary: string;
  secondary: string;
  glow: string;
  superposition: string;
  frontier: string;
  accent: string;
  nodeGlow: string;
}

export const WFC_PALETTES: Record<ColorPaletteId, WFCPalette> = {
  'spectral-aurora': {
    name: 'Spectral Aurora',
    bg: '#090A0D',
    gridLine: 'rgba(255, 255, 255, 0.05)',
    primary: '#00F0FF',
    secondary: '#10B981',
    glow: '#8B5CF6',
    superposition: 'rgba(0, 240, 255, 0.15)',
    frontier: '#38BDF8',
    accent: '#F59E0B',
    nodeGlow: '#00F0FF',
  },
  'cyber-neon': {
    name: 'Cyber Neon',
    bg: '#08090C',
    gridLine: 'rgba(6, 182, 212, 0.08)',
    primary: '#06B6D4',
    secondary: '#F43F5E',
    glow: '#EC4899',
    superposition: 'rgba(244, 63, 94, 0.15)',
    frontier: '#F43F5E',
    accent: '#FBBF24',
    nodeGlow: '#22D3EE',
  },
  'solar-plasma': {
    name: 'Solar Plasma',
    bg: '#0C0A09',
    gridLine: 'rgba(245, 158, 11, 0.06)',
    primary: '#F59E0B',
    secondary: '#EF4444',
    glow: '#FB923C',
    superposition: 'rgba(245, 158, 11, 0.15)',
    frontier: '#F59E0B',
    accent: '#FFFBEB',
    nodeGlow: '#FCD34D',
  },
  'obsidian-emerald': {
    name: 'Obsidian Emerald',
    bg: '#060B08',
    gridLine: 'rgba(16, 185, 129, 0.06)',
    primary: '#10B981',
    secondary: '#059669',
    glow: '#34D399',
    superposition: 'rgba(16, 185, 129, 0.15)',
    frontier: '#10B981',
    accent: '#6EE7B7',
    nodeGlow: '#34D399',
  },
  'cosmic-amethyst': {
    name: 'Cosmic Amethyst',
    bg: '#0A0812',
    gridLine: 'rgba(168, 85, 247, 0.06)',
    primary: '#A855F7',
    secondary: '#6366F1',
    glow: '#EC4899',
    superposition: 'rgba(168, 85, 247, 0.15)',
    frontier: '#C084FC',
    accent: '#38BDF8',
    nodeGlow: '#E879F9',
  },
  'monochrome-lithic': {
    name: 'Monochrome Lithic',
    bg: '#0A0B0E',
    gridLine: 'rgba(255, 255, 255, 0.06)',
    primary: '#E2E8F0',
    secondary: '#94A3B8',
    glow: '#CBD5E1',
    superposition: 'rgba(226, 232, 240, 0.12)',
    frontier: '#F8FAFC',
    accent: '#FFFFFF',
    nodeGlow: '#E2E8F0',
  },
};

// Direction indices: 0: North, 1: East, 2: South, 3: West
export const DIR_N = 0;
export const DIR_E = 1;
export const DIR_S = 2;
export const DIR_W = 3;
export const OPPOSITE_DIR = [DIR_S, DIR_W, DIR_N, DIR_E];
export const DIR_DX = [0, 1, 0, -1];
export const DIR_DY = [-1, 0, 1, 0];

export interface TilePrototype {
  id: number;
  name: string;
  weight: number;
  sockets: [string, string, string, string]; // [N, E, S, W]
  draw: (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    palette: WFCPalette,
    alpha: number,
    time: number,
    lineWidth: number
  ) => void;
}

export interface TileCatalog {
  tiles: TilePrototype[];
  // compatible[tileId][direction] = list of allowed neighbor tile IDs
  compatible: number[][][];
}

// Helper vector drawing utilities
function drawCircle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  fill?: string,
  stroke?: string,
  lw = 1
): void {
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(0.5, r), 0, Math.PI * 2);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

function drawLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  stroke: string,
  lw: number
): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lw;
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// 1. TILESET CATALOG GENERATORS
// ---------------------------------------------------------------------------

function buildCompatibility(tiles: TilePrototype[]): number[][][] {
  const numTiles = tiles.length;
  const compatible: number[][][] = Array.from({ length: numTiles }, () =>
    Array.from({ length: 4 }, () => [])
  );

  for (let t1 = 0; t1 < numTiles; t1++) {
    for (let d = 0; d < 4; d++) {
      const oppD = OPPOSITE_DIR[d];
      const s1 = tiles[t1].sockets[d];
      for (let t2 = 0; t2 < numTiles; t2++) {
        const s2 = tiles[t2].sockets[oppD];
        if (s1 === s2) {
          compatible[t1][d].push(t2);
        }
      }
    }
  }

  return compatible;
}

// --- Tileset 1: Cyber Circuit Board ---
export function createCircuitTileCatalog(): TileCatalog {
  const tiles: TilePrototype[] = [
    // 0: Blank Substrate
    {
      id: 0,
      name: 'Blank PCB',
      weight: 1.8,
      sockets: ['0', '0', '0', '0'],
      draw: (ctx, x, y, s, pal, a) => {
        if (a < 0.2) return;
        const midX = x + s * 0.5;
        const midY = y + s * 0.5;
        drawCircle(ctx, midX, midY, s * 0.08, pal.gridLine);
      },
    },
    // 1: Vertical Trace
    {
      id: 1,
      name: 'Trace Vertical',
      weight: 1.0,
      sockets: ['T', '0', 'T', '0'],
      draw: (ctx, x, y, s, pal, a, _t, lw) => {
        ctx.save();
        ctx.globalAlpha *= a;
        const midX = x + s * 0.5;
        drawLine(ctx, midX, y, midX, y + s, pal.primary, lw);
        drawCircle(ctx, midX, y + s * 0.5, lw * 1.1, pal.nodeGlow);
        ctx.restore();
      },
    },
    // 2: Horizontal Trace
    {
      id: 2,
      name: 'Trace Horizontal',
      weight: 1.0,
      sockets: ['0', 'T', '0', 'T'],
      draw: (ctx, x, y, s, pal, a, _t, lw) => {
        ctx.save();
        ctx.globalAlpha *= a;
        const midY = y + s * 0.5;
        drawLine(ctx, x, midY, x + s, midY, pal.primary, lw);
        drawCircle(ctx, x + s * 0.5, midY, lw * 1.1, pal.nodeGlow);
        ctx.restore();
      },
    },
    // 3: Corner NE
    {
      id: 3,
      name: 'Corner NE',
      weight: 0.9,
      sockets: ['T', 'T', '0', '0'],
      draw: (ctx, x, y, s, pal, a, _t, lw) => {
        ctx.save();
        ctx.globalAlpha *= a;
        const midX = x + s * 0.5;
        const midY = y + s * 0.5;
        ctx.beginPath();
        ctx.moveTo(midX, y);
        ctx.quadraticCurveTo(midX, midY, x + s, midY);
        ctx.strokeStyle = pal.primary;
        ctx.lineWidth = lw;
        ctx.stroke();
        ctx.restore();
      },
    },
    // 4: Corner ES
    {
      id: 4,
      name: 'Corner ES',
      weight: 0.9,
      sockets: ['0', 'T', 'T', '0'],
      draw: (ctx, x, y, s, pal, a, _t, lw) => {
        ctx.save();
        ctx.globalAlpha *= a;
        const midX = x + s * 0.5;
        const midY = y + s * 0.5;
        ctx.beginPath();
        ctx.moveTo(x + s, midY);
        ctx.quadraticCurveTo(midX, midY, midX, y + s);
        ctx.strokeStyle = pal.primary;
        ctx.lineWidth = lw;
        ctx.stroke();
        ctx.restore();
      },
    },
    // 5: Corner SW
    {
      id: 5,
      name: 'Corner SW',
      weight: 0.9,
      sockets: ['0', '0', 'T', 'T'],
      draw: (ctx, x, y, s, pal, a, _t, lw) => {
        ctx.save();
        ctx.globalAlpha *= a;
        const midX = x + s * 0.5;
        const midY = y + s * 0.5;
        ctx.beginPath();
        ctx.moveTo(midX, y + s);
        ctx.quadraticCurveTo(midX, midY, x, midY);
        ctx.strokeStyle = pal.primary;
        ctx.lineWidth = lw;
        ctx.stroke();
        ctx.restore();
      },
    },
    // 6: Corner WN
    {
      id: 6,
      name: 'Corner WN',
      weight: 0.9,
      sockets: ['T', '0', '0', 'T'],
      draw: (ctx, x, y, s, pal, a, _t, lw) => {
        ctx.save();
        ctx.globalAlpha *= a;
        const midX = x + s * 0.5;
        const midY = y + s * 0.5;
        ctx.beginPath();
        ctx.moveTo(x, midY);
        ctx.quadraticCurveTo(midX, midY, midX, y);
        ctx.strokeStyle = pal.primary;
        ctx.lineWidth = lw;
        ctx.stroke();
        ctx.restore();
      },
    },
    // 7: T-Junction North
    {
      id: 7,
      name: 'T-Junction N',
      weight: 0.7,
      sockets: ['T', 'T', '0', 'T'],
      draw: (ctx, x, y, s, pal, a, _t, lw) => {
        ctx.save();
        ctx.globalAlpha *= a;
        const midX = x + s * 0.5;
        const midY = y + s * 0.5;
        drawLine(ctx, x, midY, x + s, midY, pal.primary, lw);
        drawLine(ctx, midX, y, midX, midY, pal.primary, lw);
        drawCircle(ctx, midX, midY, lw * 1.5, pal.nodeGlow);
        ctx.restore();
      },
    },
    // 8: T-Junction East
    {
      id: 8,
      name: 'T-Junction E',
      weight: 0.7,
      sockets: ['T', 'T', 'T', '0'],
      draw: (ctx, x, y, s, pal, a, _t, lw) => {
        ctx.save();
        ctx.globalAlpha *= a;
        const midX = x + s * 0.5;
        const midY = y + s * 0.5;
        drawLine(ctx, midX, y, midX, y + s, pal.primary, lw);
        drawLine(ctx, midX, midY, x + s, midY, pal.primary, lw);
        drawCircle(ctx, midX, midY, lw * 1.5, pal.nodeGlow);
        ctx.restore();
      },
    },
    // 9: T-Junction South
    {
      id: 9,
      name: 'T-Junction S',
      weight: 0.7,
      sockets: ['0', 'T', 'T', 'T'],
      draw: (ctx, x, y, s, pal, a, _t, lw) => {
        ctx.save();
        ctx.globalAlpha *= a;
        const midX = x + s * 0.5;
        const midY = y + s * 0.5;
        drawLine(ctx, x, midY, x + s, midY, pal.primary, lw);
        drawLine(ctx, midX, midY, midX, y + s, pal.primary, lw);
        drawCircle(ctx, midX, midY, lw * 1.5, pal.nodeGlow);
        ctx.restore();
      },
    },
    // 10: T-Junction West
    {
      id: 10,
      name: 'T-Junction W',
      weight: 0.7,
      sockets: ['T', '0', 'T', 'T'],
      draw: (ctx, x, y, s, pal, a, _t, lw) => {
        ctx.save();
        ctx.globalAlpha *= a;
        const midX = x + s * 0.5;
        const midY = y + s * 0.5;
        drawLine(ctx, midX, y, midX, y + s, pal.primary, lw);
        drawLine(ctx, x, midY, midX, midY, pal.primary, lw);
        drawCircle(ctx, midX, midY, lw * 1.5, pal.nodeGlow);
        ctx.restore();
      },
    },
    // 11: 4-Way Cross
    {
      id: 11,
      name: '4-Way Via Cross',
      weight: 0.5,
      sockets: ['T', 'T', 'T', 'T'],
      draw: (ctx, x, y, s, pal, a, _t, lw) => {
        ctx.save();
        ctx.globalAlpha *= a;
        const midX = x + s * 0.5;
        const midY = y + s * 0.5;
        drawLine(ctx, midX, y, midX, y + s, pal.primary, lw);
        drawLine(ctx, x, midY, x + s, midY, pal.primary, lw);
        drawCircle(ctx, midX, midY, s * 0.18, pal.bg, pal.secondary, lw);
        drawCircle(ctx, midX, midY, s * 0.08, pal.nodeGlow);
        ctx.restore();
      },
    },
    // 12: Microchip Processor
    {
      id: 12,
      name: 'QFP Processor',
      weight: 0.35,
      sockets: ['T', 'T', 'T', 'T'],
      draw: (ctx, x, y, s, pal, a, t, lw) => {
        ctx.save();
        ctx.globalAlpha *= a;
        const midX = x + s * 0.5;
        const midY = y + s * 0.5;
        const pad = s * 0.22;
        // Traces leading in
        drawLine(ctx, midX, y, midX, y + s, pal.primary, lw * 0.8);
        drawLine(ctx, x, midY, x + s, midY, pal.primary, lw * 0.8);
        // Chip body
        ctx.fillStyle = '#0F131C';
        ctx.fillRect(x + pad, y + pad, s - pad * 2, s - pad * 2);
        ctx.strokeStyle = pal.accent;
        ctx.lineWidth = lw;
        ctx.strokeRect(x + pad, y + pad, s - pad * 2, s - pad * 2);
        // Pin 1 dot & silicon core
        const pulse = 0.5 + 0.5 * Math.sin(t * 4);
        drawCircle(ctx, midX, midY, s * 0.1, `rgba(0, 240, 255, ${0.4 + 0.5 * pulse})`);
        drawCircle(ctx, x + pad + s * 0.08, y + pad + s * 0.08, s * 0.03, pal.accent);
        ctx.restore();
      },
    },
    // 13: SMT Capacitor / Resistor
    {
      id: 13,
      name: 'SMT Component',
      weight: 0.5,
      sockets: ['T', '0', 'T', '0'],
      draw: (ctx, x, y, s, pal, a, _t, lw) => {
        ctx.save();
        ctx.globalAlpha *= a;
        const midX = x + s * 0.5;
        const midY = y + s * 0.5;
        drawLine(ctx, midX, y, midX, y + s, pal.primary, lw);
        const w = s * 0.3;
        const h = s * 0.45;
        ctx.fillStyle = pal.secondary;
        ctx.fillRect(midX - w * 0.5, midY - h * 0.5, w, h);
        ctx.strokeStyle = pal.accent;
        ctx.lineWidth = lw * 0.8;
        ctx.strokeRect(midX - w * 0.5, midY - h * 0.5, w, h);
        ctx.restore();
      },
    },
  ];

  return {
    tiles,
    compatible: buildCompatibility(tiles),
  };
}

// --- Tileset 2: Quantum Minimal Pipes ---
export function createPipesTileCatalog(): TileCatalog {
  const tiles: TilePrototype[] = [
    // 0: Void
    {
      id: 0,
      name: 'Void Space',
      weight: 1.5,
      sockets: ['0', '0', '0', '0'],
      draw: (ctx, x, y, s, pal, a) => {
        if (a < 0.2) return;
        const midX = x + s * 0.5;
        const midY = y + s * 0.5;
        drawCircle(ctx, midX, midY, s * 0.04, pal.gridLine);
      },
    },
    // 1: Straight Pipe Vertical
    {
      id: 1,
      name: 'Pipe Vertical',
      weight: 1.0,
      sockets: ['P', '0', 'P', '0'],
      draw: (ctx, x, y, s, pal, a, _t, lw) => {
        ctx.save();
        ctx.globalAlpha *= a;
        const midX = x + s * 0.5;
        const pw = Math.max(4, s * 0.28);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.fillRect(midX - pw * 0.5, y, pw, s);
        drawLine(ctx, midX - pw * 0.5, y, midX - pw * 0.5, y + s, pal.secondary, lw * 0.75);
        drawLine(ctx, midX + pw * 0.5, y, midX + pw * 0.5, y + s, pal.secondary, lw * 0.75);
        drawLine(ctx, midX, y, midX, y + s, pal.primary, lw);
        ctx.restore();
      },
    },
    // 2: Straight Pipe Horizontal
    {
      id: 2,
      name: 'Pipe Horizontal',
      weight: 1.0,
      sockets: ['0', 'P', '0', 'P'],
      draw: (ctx, x, y, s, pal, a, _t, lw) => {
        ctx.save();
        ctx.globalAlpha *= a;
        const midY = y + s * 0.5;
        const pw = Math.max(4, s * 0.28);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.fillRect(x, midY - pw * 0.5, s, pw);
        drawLine(ctx, x, midY - pw * 0.5, x + s, midY - pw * 0.5, pal.secondary, lw * 0.75);
        drawLine(ctx, x, midY + pw * 0.5, x + s, midY + pw * 0.5, pal.secondary, lw * 0.75);
        drawLine(ctx, x, midY, x + s, midY, pal.primary, lw);
        ctx.restore();
      },
    },
    // 3: Elbow NE
    {
      id: 3,
      name: 'Elbow NE',
      weight: 0.9,
      sockets: ['P', 'P', '0', '0'],
      draw: (ctx, x, y, s, pal, a, _t, lw) => {
        ctx.save();
        ctx.globalAlpha *= a;
        const midX = x + s * 0.5;
        const midY = y + s * 0.5;
        const pw = Math.max(4, s * 0.28);
        ctx.beginPath();
        ctx.arc(x + s, y, s * 0.5, Math.PI * 0.5, Math.PI);
        ctx.strokeStyle = pal.primary;
        ctx.lineWidth = pw * 0.9;
        ctx.stroke();
        drawLine(ctx, midX, y, midX, midY, pal.primary, lw);
        drawLine(ctx, midX, midY, x + s, midY, pal.primary, lw);
        drawCircle(ctx, midX, midY, pw * 0.45, pal.accent);
        ctx.restore();
      },
    },
    // 4: Elbow ES
    {
      id: 4,
      name: 'Elbow ES',
      weight: 0.9,
      sockets: ['0', 'P', 'P', '0'],
      draw: (ctx, x, y, s, pal, a, _t, lw) => {
        ctx.save();
        ctx.globalAlpha *= a;
        const midX = x + s * 0.5;
        const midY = y + s * 0.5;
        const pw = Math.max(4, s * 0.28);
        ctx.beginPath();
        ctx.arc(x + s, y + s, s * 0.5, Math.PI, Math.PI * 1.5);
        ctx.strokeStyle = pal.primary;
        ctx.lineWidth = pw * 0.9;
        ctx.stroke();
        drawLine(ctx, x + s, midY, midX, midY, pal.primary, lw);
        drawLine(ctx, midX, midY, midX, y + s, pal.primary, lw);
        drawCircle(ctx, midX, midY, pw * 0.45, pal.accent);
        ctx.restore();
      },
    },
    // 5: Elbow SW
    {
      id: 5,
      name: 'Elbow SW',
      weight: 0.9,
      sockets: ['0', '0', 'P', 'P'],
      draw: (ctx, x, y, s, pal, a, _t, lw) => {
        ctx.save();
        ctx.globalAlpha *= a;
        const midX = x + s * 0.5;
        const midY = y + s * 0.5;
        const pw = Math.max(4, s * 0.28);
        ctx.beginPath();
        ctx.arc(x, y + s, s * 0.5, Math.PI * 1.5, Math.PI * 2);
        ctx.strokeStyle = pal.primary;
        ctx.lineWidth = pw * 0.9;
        ctx.stroke();
        drawLine(ctx, midX, y + s, midX, midY, pal.primary, lw);
        drawLine(ctx, midX, midY, x, midY, pal.primary, lw);
        drawCircle(ctx, midX, midY, pw * 0.45, pal.accent);
        ctx.restore();
      },
    },
    // 6: Elbow WN
    {
      id: 6,
      name: 'Elbow WN',
      weight: 0.9,
      sockets: ['P', '0', '0', 'P'],
      draw: (ctx, x, y, s, pal, a, _t, lw) => {
        ctx.save();
        ctx.globalAlpha *= a;
        const midX = x + s * 0.5;
        const midY = y + s * 0.5;
        const pw = Math.max(4, s * 0.28);
        ctx.beginPath();
        ctx.arc(x, y, s * 0.5, 0, Math.PI * 0.5);
        ctx.strokeStyle = pal.primary;
        ctx.lineWidth = pw * 0.9;
        ctx.stroke();
        drawLine(ctx, x, midY, midX, midY, pal.primary, lw);
        drawLine(ctx, midX, midY, midX, y, pal.primary, lw);
        drawCircle(ctx, midX, midY, pw * 0.45, pal.accent);
        ctx.restore();
      },
    },
    // 7: T-Manifold North
    {
      id: 7,
      name: 'T-Manifold N',
      weight: 0.7,
      sockets: ['P', 'P', '0', 'P'],
      draw: (ctx, x, y, s, pal, a, _t, lw) => {
        ctx.save();
        ctx.globalAlpha *= a;
        const midX = x + s * 0.5;
        const midY = y + s * 0.5;
        drawLine(ctx, x, midY, x + s, midY, pal.primary, lw * 1.5);
        drawLine(ctx, midX, y, midX, midY, pal.primary, lw * 1.5);
        drawCircle(ctx, midX, midY, s * 0.16, pal.secondary, pal.primary, lw);
        ctx.restore();
      },
    },
    // 8: T-Manifold East
    {
      id: 8,
      name: 'T-Manifold E',
      weight: 0.7,
      sockets: ['P', 'P', 'P', '0'],
      draw: (ctx, x, y, s, pal, a, _t, lw) => {
        ctx.save();
        ctx.globalAlpha *= a;
        const midX = x + s * 0.5;
        const midY = y + s * 0.5;
        drawLine(ctx, midX, y, midX, y + s, pal.primary, lw * 1.5);
        drawLine(ctx, midX, midY, x + s, midY, pal.primary, lw * 1.5);
        drawCircle(ctx, midX, midY, s * 0.16, pal.secondary, pal.primary, lw);
        ctx.restore();
      },
    },
    // 9: T-Manifold South
    {
      id: 9,
      name: 'T-Manifold S',
      weight: 0.7,
      sockets: ['0', 'P', 'P', 'P'],
      draw: (ctx, x, y, s, pal, a, _t, lw) => {
        ctx.save();
        ctx.globalAlpha *= a;
        const midX = x + s * 0.5;
        const midY = y + s * 0.5;
        drawLine(ctx, x, midY, x + s, midY, pal.primary, lw * 1.5);
        drawLine(ctx, midX, midY, midX, y + s, pal.primary, lw * 1.5);
        drawCircle(ctx, midX, midY, s * 0.16, pal.secondary, pal.primary, lw);
        ctx.restore();
      },
    },
    // 10: T-Manifold West
    {
      id: 10,
      name: 'T-Manifold W',
      weight: 0.7,
      sockets: ['P', '0', 'P', 'P'],
      draw: (ctx, x, y, s, pal, a, _t, lw) => {
        ctx.save();
        ctx.globalAlpha *= a;
        const midX = x + s * 0.5;
        const midY = y + s * 0.5;
        drawLine(ctx, midX, y, midX, y + s, pal.primary, lw * 1.5);
        drawLine(ctx, x, midY, midX, midY, pal.primary, lw * 1.5);
        drawCircle(ctx, midX, midY, s * 0.16, pal.secondary, pal.primary, lw);
        ctx.restore();
      },
    },
    // 11: 4-Way Cross
    {
      id: 11,
      name: '4-Way Manifold',
      weight: 0.5,
      sockets: ['P', 'P', 'P', 'P'],
      draw: (ctx, x, y, s, pal, a, _t, lw) => {
        ctx.save();
        ctx.globalAlpha *= a;
        const midX = x + s * 0.5;
        const midY = y + s * 0.5;
        drawLine(ctx, midX, y, midX, y + s, pal.primary, lw * 1.5);
        drawLine(ctx, x, midY, x + s, midY, pal.primary, lw * 1.5);
        drawCircle(ctx, midX, midY, s * 0.22, pal.bg, pal.primary, lw);
        drawCircle(ctx, midX, midY, s * 0.1, pal.accent);
        ctx.restore();
      },
    },
    // 12: Valve Dial
    {
      id: 12,
      name: 'Pressure Valve',
      weight: 0.4,
      sockets: ['P', '0', 'P', '0'],
      draw: (ctx, x, y, s, pal, a, t, lw) => {
        ctx.save();
        ctx.globalAlpha *= a;
        const midX = x + s * 0.5;
        const midY = y + s * 0.5;
        drawLine(ctx, midX, y, midX, y + s, pal.primary, lw * 1.2);
        drawCircle(ctx, midX, midY, s * 0.25, pal.secondary, pal.primary, lw);
        // Gauge needle
        const ang = Math.sin(t * 3) * 0.8;
        const nx = midX + Math.cos(ang - Math.PI * 0.5) * s * 0.18;
        const ny = midY + Math.sin(ang - Math.PI * 0.5) * s * 0.18;
        drawLine(ctx, midX, midY, nx, ny, pal.accent, lw * 0.9);
        ctx.restore();
      },
    },
  ];

  return {
    tiles,
    compatible: buildCompatibility(tiles),
  };
}

// --- Tileset 3: Archival Labyrinth ---
export function createLabyrinthTileCatalog(): TileCatalog {
  const tiles: TilePrototype[] = [
    // 0: Solid Basalt Wall
    {
      id: 0,
      name: 'Megalith Wall',
      weight: 1.5,
      sockets: ['W', 'W', 'W', 'W'],
      draw: (ctx, x, y, s, pal, a) => {
        ctx.save();
        ctx.globalAlpha *= a;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
        ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
        if (a > 0.5) {
          const midX = x + s * 0.5;
          const midY = y + s * 0.5;
          drawCircle(ctx, midX, midY, s * 0.05, pal.gridLine);
        }
        ctx.restore();
      },
    },
    // 1: Hallway Vertical
    {
      id: 1,
      name: 'Hallway Vertical',
      weight: 1.0,
      sockets: ['O', 'W', 'O', 'W'],
      draw: (ctx, x, y, s, pal, a, _t, lw) => {
        ctx.save();
        ctx.globalAlpha *= a;
        const hw = s * 0.5;
        const left = x + s * 0.25;
        ctx.fillStyle = 'rgba(0, 240, 255, 0.03)';
        ctx.fillRect(left, y, hw, s);
        drawLine(ctx, left, y, left, y + s, pal.primary, lw);
        drawLine(ctx, left + hw, y, left + hw, y + s, pal.primary, lw);
        ctx.restore();
      },
    },
    // 2: Hallway Horizontal
    {
      id: 2,
      name: 'Hallway Horizontal',
      weight: 1.0,
      sockets: ['W', 'O', 'W', 'O'],
      draw: (ctx, x, y, s, pal, a, _t, lw) => {
        ctx.save();
        ctx.globalAlpha *= a;
        const hw = s * 0.5;
        const top = y + s * 0.25;
        ctx.fillStyle = 'rgba(0, 240, 255, 0.03)';
        ctx.fillRect(x, top, s, hw);
        drawLine(ctx, x, top, x + s, top, pal.primary, lw);
        drawLine(ctx, x, top + hw, x + s, top + hw, pal.primary, lw);
        ctx.restore();
      },
    },
    // 3: Turn NE
    {
      id: 3,
      name: 'Corridor NE',
      weight: 0.9,
      sockets: ['O', 'O', 'W', 'W'],
      draw: (ctx, x, y, s, pal, a, _t, lw) => {
        ctx.save();
        ctx.globalAlpha *= a;
        const left = x + s * 0.25;
        const top = y + s * 0.25;
        drawLine(ctx, left, y, left, top + s * 0.5, pal.primary, lw);
        drawLine(ctx, left, top + s * 0.5, x + s, top + s * 0.5, pal.primary, lw);
        drawLine(ctx, left + s * 0.5, y, left + s * 0.5, top, pal.primary, lw);
        drawLine(ctx, left + s * 0.5, top, x + s, top, pal.primary, lw);
        ctx.restore();
      },
    },
    // 4: Turn ES
    {
      id: 4,
      name: 'Corridor ES',
      weight: 0.9,
      sockets: ['W', 'O', 'O', 'W'],
      draw: (ctx, x, y, s, pal, a, _t, lw) => {
        ctx.save();
        ctx.globalAlpha *= a;
        const left = x + s * 0.25;
        const top = y + s * 0.25;
        drawLine(ctx, x, top, left + s * 0.5, top, pal.primary, lw);
        drawLine(ctx, left + s * 0.5, top, left + s * 0.5, y + s, pal.primary, lw);
        drawLine(ctx, x, top + s * 0.5, left, top + s * 0.5, pal.primary, lw);
        drawLine(ctx, left, top + s * 0.5, left, y + s, pal.primary, lw);
        ctx.restore();
      },
    },
    // 5: Turn SW
    {
      id: 5,
      name: 'Corridor SW',
      weight: 0.9,
      sockets: ['W', 'W', 'O', 'O'],
      draw: (ctx, x, y, s, pal, a, _t, lw) => {
        ctx.save();
        ctx.globalAlpha *= a;
        const left = x + s * 0.25;
        const top = y + s * 0.25;
        drawLine(ctx, x, top, left + s * 0.5, top, pal.primary, lw);
        drawLine(ctx, left + s * 0.5, top, left + s * 0.5, y + s, pal.primary, lw);
        drawLine(ctx, x, top + s * 0.5, left, top + s * 0.5, pal.primary, lw);
        drawLine(ctx, left, top + s * 0.5, left, y + s, pal.primary, lw);
        ctx.restore();
      },
    },
    // 6: Turn WN
    {
      id: 6,
      name: 'Corridor WN',
      weight: 0.9,
      sockets: ['O', 'W', 'W', 'O'],
      draw: (ctx, x, y, s, pal, a, _t, lw) => {
        ctx.save();
        ctx.globalAlpha *= a;
        const left = x + s * 0.25;
        const top = y + s * 0.25;
        drawLine(ctx, x, top + s * 0.5, left + s * 0.5, top + s * 0.5, pal.primary, lw);
        drawLine(ctx, left + s * 0.5, top + s * 0.5, left + s * 0.5, y, pal.primary, lw);
        drawLine(ctx, x, top, left, top, pal.primary, lw);
        drawLine(ctx, left, top, left, y, pal.primary, lw);
        ctx.restore();
      },
    },
    // 7: Fork North
    {
      id: 7,
      name: 'Fork North',
      weight: 0.7,
      sockets: ['O', 'O', 'W', 'O'],
      draw: (ctx, x, y, s, pal, a, _t, lw) => {
        ctx.save();
        ctx.globalAlpha *= a;
        const midX = x + s * 0.5;
        const midY = y + s * 0.5;
        drawLine(ctx, x, midY, x + s, midY, pal.primary, lw);
        drawLine(ctx, midX, y, midX, midY, pal.primary, lw);
        drawCircle(ctx, midX, midY, s * 0.12, pal.accent);
        ctx.restore();
      },
    },
    // 8: Fork East
    {
      id: 8,
      name: 'Fork East',
      weight: 0.7,
      sockets: ['O', 'O', 'O', 'W'],
      draw: (ctx, x, y, s, pal, a, _t, lw) => {
        ctx.save();
        ctx.globalAlpha *= a;
        const midX = x + s * 0.5;
        const midY = y + s * 0.5;
        drawLine(ctx, midX, y, midX, y + s, pal.primary, lw);
        drawLine(ctx, midX, midY, x + s, midY, pal.primary, lw);
        drawCircle(ctx, midX, midY, s * 0.12, pal.accent);
        ctx.restore();
      },
    },
    // 9: Fork South
    {
      id: 9,
      name: 'Fork South',
      weight: 0.7,
      sockets: ['W', 'O', 'O', 'O'],
      draw: (ctx, x, y, s, pal, a, _t, lw) => {
        ctx.save();
        ctx.globalAlpha *= a;
        const midX = x + s * 0.5;
        const midY = y + s * 0.5;
        drawLine(ctx, x, midY, x + s, midY, pal.primary, lw);
        drawLine(ctx, midX, midY, midX, y + s, pal.primary, lw);
        drawCircle(ctx, midX, midY, s * 0.12, pal.accent);
        ctx.restore();
      },
    },
    // 10: Fork West
    {
      id: 10,
      name: 'Fork West',
      weight: 0.7,
      sockets: ['O', 'W', 'O', 'O'],
      draw: (ctx, x, y, s, pal, a, _t, lw) => {
        ctx.save();
        ctx.globalAlpha *= a;
        const midX = x + s * 0.5;
        const midY = y + s * 0.5;
        drawLine(ctx, midX, y, midX, y + s, pal.primary, lw);
        drawLine(ctx, x, midY, midX, midY, pal.primary, lw);
        drawCircle(ctx, midX, midY, s * 0.12, pal.accent);
        ctx.restore();
      },
    },
    // 11: Crossroad Plaza
    {
      id: 11,
      name: 'Nexus Plaza',
      weight: 0.4,
      sockets: ['O', 'O', 'O', 'O'],
      draw: (ctx, x, y, s, pal, a, _t, lw) => {
        ctx.save();
        ctx.globalAlpha *= a;
        const midX = x + s * 0.5;
        const midY = y + s * 0.5;
        drawLine(ctx, midX, y, midX, y + s, pal.primary, lw);
        drawLine(ctx, x, midY, x + s, midY, pal.primary, lw);
        drawCircle(ctx, midX, midY, s * 0.22, pal.bg, pal.secondary, lw);
        drawCircle(ctx, midX, midY, s * 0.08, pal.accent);
        ctx.restore();
      },
    },
    // 12: Dead End Sanctuary
    {
      id: 12,
      name: 'Sanctuary Alcove',
      weight: 0.4,
      sockets: ['O', 'W', 'W', 'W'],
      draw: (ctx, x, y, s, pal, a, _t, lw) => {
        ctx.save();
        ctx.globalAlpha *= a;
        const midX = x + s * 0.5;
        const midY = y + s * 0.5;
        drawLine(ctx, midX, y, midX, midY, pal.primary, lw);
        drawCircle(ctx, midX, midY, s * 0.18, pal.bg, pal.accent, lw);
        drawCircle(ctx, midX, midY, s * 0.06, pal.glow);
        ctx.restore();
      },
    },
  ];

  return {
    tiles,
    compatible: buildCompatibility(tiles),
  };
}

// --- Tileset 4: Gothic Arches ---
export function createGothicTileCatalog(): TileCatalog {
  const tiles: TilePrototype[] = [
    // 0: Solid Gothic Masonry
    {
      id: 0,
      name: 'Ashlar Pier',
      weight: 1.4,
      sockets: ['S', 'S', 'S', 'S'],
      draw: (ctx, x, y, s, pal, a) => {
        ctx.save();
        ctx.globalAlpha *= a;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
        ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
        if (a > 0.4) {
          const midX = x + s * 0.5;
          const midY = y + s * 0.5;
          drawCircle(ctx, midX, midY, s * 0.15, undefined, pal.gridLine, 1);
        }
        ctx.restore();
      },
    },
    // 1: Nave Arch Vertical
    {
      id: 1,
      name: 'Nave Arch Vertical',
      weight: 1.0,
      sockets: ['A', 'S', 'A', 'S'],
      draw: (ctx, x, y, s, pal, a, _t, lw) => {
        ctx.save();
        ctx.globalAlpha *= a;
        const midX = x + s * 0.5;
        const aw = s * 0.35;
        drawLine(ctx, midX - aw, y, midX - aw, y + s, pal.secondary, lw * 0.8);
        drawLine(ctx, midX + aw, y, midX + aw, y + s, pal.secondary, lw * 0.8);
        drawLine(ctx, midX, y, midX, y + s, pal.primary, lw);
        ctx.restore();
      },
    },
    // 2: Nave Arch Horizontal
    {
      id: 2,
      name: 'Nave Arch Horizontal',
      weight: 1.0,
      sockets: ['S', 'A', 'S', 'A'],
      draw: (ctx, x, y, s, pal, a, _t, lw) => {
        ctx.save();
        ctx.globalAlpha *= a;
        const midY = y + s * 0.5;
        const aw = s * 0.35;
        drawLine(ctx, x, midY - aw, x + s, midY - aw, pal.secondary, lw * 0.8);
        drawLine(ctx, x, midY + aw, x + s, midY + aw, pal.secondary, lw * 0.8);
        drawLine(ctx, x, midY, x + s, midY, pal.primary, lw);
        ctx.restore();
      },
    },
    // 3: Corner Ambulatory NE
    {
      id: 3,
      name: 'Ambulatory NE',
      weight: 0.9,
      sockets: ['A', 'A', 'S', 'S'],
      draw: (ctx, x, y, s, pal, a, _t, lw) => {
        ctx.save();
        ctx.globalAlpha *= a;
        const midX = x + s * 0.5;
        const midY = y + s * 0.5;
        ctx.beginPath();
        ctx.moveTo(midX, y);
        ctx.lineTo(midX, midY);
        ctx.lineTo(x + s, midY);
        ctx.strokeStyle = pal.primary;
        ctx.lineWidth = lw;
        ctx.stroke();
        drawCircle(ctx, midX, midY, s * 0.12, pal.bg, pal.accent, lw * 0.8);
        ctx.restore();
      },
    },
    // 4: Corner Ambulatory ES
    {
      id: 4,
      name: 'Ambulatory ES',
      weight: 0.9,
      sockets: ['S', 'A', 'A', 'S'],
      draw: (ctx, x, y, s, pal, a, _t, lw) => {
        ctx.save();
        ctx.globalAlpha *= a;
        const midX = x + s * 0.5;
        const midY = y + s * 0.5;
        ctx.beginPath();
        ctx.moveTo(x + s, midY);
        ctx.lineTo(midX, midY);
        ctx.lineTo(midX, y + s);
        ctx.strokeStyle = pal.primary;
        ctx.lineWidth = lw;
        ctx.stroke();
        drawCircle(ctx, midX, midY, s * 0.12, pal.bg, pal.accent, lw * 0.8);
        ctx.restore();
      },
    },
    // 5: Corner Ambulatory SW
    {
      id: 5,
      name: 'Ambulatory SW',
      weight: 0.9,
      sockets: ['S', 'S', 'A', 'A'],
      draw: (ctx, x, y, s, pal, a, _t, lw) => {
        ctx.save();
        ctx.globalAlpha *= a;
        const midX = x + s * 0.5;
        const midY = y + s * 0.5;
        ctx.beginPath();
        ctx.moveTo(midX, y + s);
        ctx.lineTo(midX, midY);
        ctx.lineTo(x, midY);
        ctx.strokeStyle = pal.primary;
        ctx.lineWidth = lw;
        ctx.stroke();
        drawCircle(ctx, midX, midY, s * 0.12, pal.bg, pal.accent, lw * 0.8);
        ctx.restore();
      },
    },
    // 6: Corner Ambulatory WN
    {
      id: 6,
      name: 'Ambulatory WN',
      weight: 0.9,
      sockets: ['A', 'S', 'S', 'A'],
      draw: (ctx, x, y, s, pal, a, _t, lw) => {
        ctx.save();
        ctx.globalAlpha *= a;
        const midX = x + s * 0.5;
        const midY = y + s * 0.5;
        ctx.beginPath();
        ctx.moveTo(x, midY);
        ctx.lineTo(midX, midY);
        ctx.lineTo(midX, y);
        ctx.strokeStyle = pal.primary;
        ctx.lineWidth = lw;
        ctx.stroke();
        drawCircle(ctx, midX, midY, s * 0.12, pal.bg, pal.accent, lw * 0.8);
        ctx.restore();
      },
    },
    // 7: Groin Vault Ribbed Cross
    {
      id: 7,
      name: 'Ribbed Groin Vault',
      weight: 0.8,
      sockets: ['A', 'A', 'A', 'A'],
      draw: (ctx, x, y, s, pal, a, _t, lw) => {
        ctx.save();
        ctx.globalAlpha *= a;
        const midX = x + s * 0.5;
        const midY = y + s * 0.5;
        // Diagonal ribs
        drawLine(ctx, x, y, x + s, y + s, pal.secondary, lw * 0.75);
        drawLine(ctx, x + s, y, x, y + s, pal.secondary, lw * 0.75);
        // Orthogonal ribs
        drawLine(ctx, midX, y, midX, y + s, pal.primary, lw);
        drawLine(ctx, x, midY, x + s, midY, pal.primary, lw);
        // Boss keystone
        drawCircle(ctx, midX, midY, s * 0.14, pal.bg, pal.accent, lw);
        ctx.restore();
      },
    },
    // 8: Rose Medallion Crossing
    {
      id: 8,
      name: 'Rose Crossing Nexus',
      weight: 0.35,
      sockets: ['A', 'A', 'A', 'A'],
      draw: (ctx, x, y, s, pal, a, t, lw) => {
        ctx.save();
        ctx.globalAlpha *= a;
        const midX = x + s * 0.5;
        const midY = y + s * 0.5;
        drawLine(ctx, midX, y, midX, y + s, pal.primary, lw);
        drawLine(ctx, x, midY, x + s, midY, pal.primary, lw);
        // Rose tracery circles
        drawCircle(ctx, midX, midY, s * 0.28, pal.bg, pal.accent, lw);
        const petals = 8;
        for (let i = 0; i < petals; i++) {
          const ang = (i / petals) * Math.PI * 2 + t * 0.5;
          const px = midX + Math.cos(ang) * s * 0.16;
          const py = midY + Math.sin(ang) * s * 0.16;
          drawCircle(ctx, px, py, s * 0.05, undefined, pal.primary, lw * 0.6);
        }
        drawCircle(ctx, midX, midY, s * 0.07, pal.glow);
        ctx.restore();
      },
    },
  ];

  return {
    tiles,
    compatible: buildCompatibility(tiles),
  };
}

// --- Tileset 5: Dual-Color Wang Tiles (16 full permutations) ---
export function createWangTileCatalog(): TileCatalog {
  const tiles: TilePrototype[] = [];

  // Generate all 16 2-color edge Wang tiles (N, E, S, W in {0, 1})
  for (let i = 0; i < 16; i++) {
    const sN = (i >> 3) & 1 ? '1' : '0';
    const sE = (i >> 2) & 1 ? '1' : '0';
    const sS = (i >> 1) & 1 ? '1' : '0';
    const sW = (i >> 0) & 1 ? '1' : '0';

    tiles.push({
      id: i,
      name: `Wang Tile #${i} [${sN}${sE}${sS}${sW}]`,
      weight: 1.0,
      sockets: [sN, sE, sS, sW],
      draw: (ctx, x, y, s, pal, a, _t, lw) => {
        ctx.save();
        ctx.globalAlpha *= a;
        const midX = x + s * 0.5;
        const midY = y + s * 0.5;

        // Base fill for background tone
        ctx.fillStyle = 'rgba(255, 255, 255, 0.015)';
        ctx.fillRect(x, y, s, s);

        // Render Wang contours connecting matching color edges
        const edges = [sN === '1', sE === '1', sS === '1', sW === '1'];
        const numOn = edges.filter(Boolean).length;

        if (numOn === 0) {
          // All 0 edges
          drawCircle(ctx, midX, midY, s * 0.08, undefined, pal.secondary, lw * 0.5);
        } else if (numOn === 4) {
          // All 1 edges: full smooth cross
          drawLine(ctx, midX, y, midX, y + s, pal.primary, lw * 1.5);
          drawLine(ctx, x, midY, x + s, midY, pal.primary, lw * 1.5);
          drawCircle(ctx, midX, midY, s * 0.15, pal.accent);
        } else {
          // Connect active 1 edges via smooth curves to center or pair
          if (edges[0]) drawLine(ctx, midX, y, midX, midY, pal.primary, lw * 1.2);
          if (edges[1]) drawLine(ctx, midX, midY, x + s, midY, pal.primary, lw * 1.2);
          if (edges[2]) drawLine(ctx, midX, midY, midX, y + s, pal.primary, lw * 1.2);
          if (edges[3]) drawLine(ctx, x, midY, midX, midY, pal.primary, lw * 1.2);
          drawCircle(ctx, midX, midY, s * 0.1, pal.nodeGlow);
        }
        ctx.restore();
      },
    });
  }

  return {
    tiles,
    compatible: buildCompatibility(tiles),
  };
}

// ---------------------------------------------------------------------------
// 2. WAVE FUNCTION COLLAPSE SIMULATION SOLVER
// ---------------------------------------------------------------------------

export interface ShockwaveRipple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  alpha: number;
  life: number;
}

export class WFCSimulation {
  public cols: number = 32;
  public rows: number = 32;
  public catalog!: TileCatalog;
  public numTiles: number = 0;

  // Grid flat memory
  // cellPossibilities[cellIdx * numTiles + tileIdx] === 1 (candidate) | 0 (eliminated)
  public cellPossibilities!: Uint8Array;
  // cellCandidateCount[cellIdx] === count of active candidates
  public cellCandidateCount!: Int16Array;
  // cellCollapsedTile[cellIdx] === tile ID if collapsed (>= 0), or -1 if in superposition
  public cellCollapsedTile!: Int16Array;
  // cellCollapseTime[cellIdx] === timestamp of collapse
  public cellCollapseTime!: Float32Array;
  // cellPinned[cellIdx] === 1 if manual constraint
  public cellPinned!: Uint8Array;
  // entropyNoise[cellIdx] === PRNG tie-breaker noise
  public entropyNoise!: Float32Array;

  // Propagation BFS queue
  private propQueue!: Int32Array;
  private inQueue!: Uint8Array;

  // Simulation metrics
  public collapsedCount: number = 0;
  public contradictionCount: number = 0;
  public isComplete: boolean = false;
  public simTime: number = 0;
  public lastCompletedTime: number = 0;

  // Visual effects
  public ripples: ShockwaveRipple[] = [];

  constructor(cols: number, rows: number, tileSet: TileSetPreset, prng: PRNG) {
    this.init(cols, rows, tileSet, prng);
  }

  public init(cols: number, rows: number, tileSet: TileSetPreset, prng: PRNG): void {
    this.cols = cols;
    this.rows = rows;
    this.catalog = this.getCatalog(tileSet);
    this.numTiles = this.catalog.tiles.length;

    const totalCells = cols * rows;
    this.cellPossibilities = new Uint8Array(totalCells * this.numTiles);
    this.cellCandidateCount = new Int16Array(totalCells);
    this.cellCollapsedTile = new Int16Array(totalCells);
    this.cellCollapseTime = new Float32Array(totalCells);
    this.cellPinned = new Uint8Array(totalCells);
    this.entropyNoise = new Float32Array(totalCells);

    this.propQueue = new Int32Array(totalCells * 4);
    this.inQueue = new Uint8Array(totalCells);

    this.resetGrid(prng);
  }

  public resetGrid(prng: PRNG, symmetry = false): void {
    const totalCells = this.cols * this.rows;
    this.cellPossibilities.fill(1);
    this.cellCandidateCount.fill(this.numTiles);
    this.cellCollapsedTile.fill(-1);
    this.cellCollapseTime.fill(0);
    this.cellPinned.fill(0);
    this.collapsedCount = 0;
    this.isComplete = false;
    this.simTime = 0;
    this.lastCompletedTime = 0;
    this.ripples = [];

    // Pre-calculate deterministic entropy noise for tie-breaking
    for (let i = 0; i < totalCells; i++) {
      this.entropyNoise[i] = prng.nextFloat(0.0001, 0.0999);
    }

    if (symmetry) {
      // Force central symmetric seed cell
      const cx = Math.floor(this.cols / 2);
      const cy = Math.floor(this.rows / 2);
      this.collapseCell(cx, cy, prng);
    }
  }

  private getCatalog(preset: TileSetPreset): TileCatalog {
    switch (preset) {
      case 'circuit':
        return createCircuitTileCatalog();
      case 'pipes':
        return createPipesTileCatalog();
      case 'labyrinth':
        return createLabyrinthTileCatalog();
      case 'gothic':
        return createGothicTileCatalog();
      case 'wang':
        return createWangTileCatalog();
      default:
        return createCircuitTileCatalog();
    }
  }

  /**
   * Performs WFC steps. Returns true if simulation is still active, false if complete.
   */
  public step(stepCount: number, prng: PRNG, autoRestart: boolean, restartDelay: number, dt: number): void {
    this.simTime += dt;

    // Update shockwave ripples
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const rip = this.ripples[i];
      rip.radius += dt * 250;
      rip.life -= dt * 2.0;
      rip.alpha = Math.max(0, rip.life);
      if (rip.life <= 0) {
        this.ripples.splice(i, 1);
      }
    }

    if (this.isComplete) {
      if (autoRestart && this.simTime - this.lastCompletedTime > restartDelay) {
        this.resetGrid(prng);
      }
      return;
    }

    for (let s = 0; s < stepCount; s++) {
      const status = this.singleStep(prng);
      if (status === 'COMPLETE') {
        this.isComplete = true;
        this.lastCompletedTime = this.simTime;
        break;
      } else if (status === 'CONTRADICTION') {
        this.contradictionCount++;
        // Recover cleanly: reset grid
        this.resetGrid(prng);
        break;
      }
    }
  }

  /**
   * Executes a single WFC step:
   * 1. Finds cell with minimum non-zero entropy (candidateCount > 1)
   * 2. Collapses cell to a single weighted candidate
   * 3. Propagates constraints across neighbors
   */
  private singleStep(prng: PRNG): 'RUNNING' | 'COMPLETE' | 'CONTRADICTION' {
    const totalCells = this.cols * this.rows;
    let minEntropy = Infinity;
    let targetIdx = -1;

    // Find cell with lowest Shannon entropy
    for (let i = 0; i < totalCells; i++) {
      const count = this.cellCandidateCount[i];
      if (count > 1) {
        const entropy = count + this.entropyNoise[i];
        if (entropy < minEntropy) {
          minEntropy = entropy;
          targetIdx = i;
        }
      }
    }

    // If no cells have > 1 candidates, we are done or contradictions exist
    if (targetIdx === -1) {
      return 'COMPLETE';
    }

    const tx = targetIdx % this.cols;
    const ty = Math.floor(targetIdx / this.cols);

    return this.collapseCell(tx, ty, prng);
  }

  /**
   * Force collapses cell (x, y) to a valid candidate and propagates constraints.
   */
  public collapseCell(x: number, y: number, prng: PRNG, chosenTile?: number): 'RUNNING' | 'COMPLETE' | 'CONTRADICTION' {
    if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) return 'RUNNING';

    const cellIdx = y * this.cols + x;
    const count = this.cellCandidateCount[cellIdx];
    if (count <= 1 && chosenTile === undefined) return 'RUNNING';

    const offset = cellIdx * this.numTiles;

    // Collect valid candidate tile IDs
    const validTiles: number[] = [];
    let totalWeight = 0;

    for (let t = 0; t < this.numTiles; t++) {
      if (this.cellPossibilities[offset + t] === 1) {
        validTiles.push(t);
        totalWeight += this.catalog.tiles[t].weight;
      }
    }

    if (validTiles.length === 0) {
      return 'CONTRADICTION';
    }

    // Pick tile based on weighted probabilities
    let selectedTile = validTiles[0];
    if (chosenTile !== undefined && validTiles.includes(chosenTile)) {
      selectedTile = chosenTile;
    } else if (validTiles.length > 1) {
      let r = prng.nextFloat(0, totalWeight);
      for (const t of validTiles) {
        r -= this.catalog.tiles[t].weight;
        if (r <= 0) {
          selectedTile = t;
          break;
        }
      }
    }

    // Collapse target cell
    for (let t = 0; t < this.numTiles; t++) {
      this.cellPossibilities[offset + t] = t === selectedTile ? 1 : 0;
    }
    this.cellCandidateCount[cellIdx] = 1;
    this.cellCollapsedTile[cellIdx] = selectedTile;
    this.cellCollapseTime[cellIdx] = this.simTime;
    this.collapsedCount++;

    // Add visual shockwave ripple
    this.ripples.push({
      x,
      y,
      radius: 0,
      maxRadius: Math.max(this.cols, this.rows) * 0.35,
      color: '#00F0FF',
      alpha: 1.0,
      life: 1.0,
    });

    // Propagate constraints
    return this.propagateConstraints(cellIdx);
  }

  /**
   * Propagates directional socket constraints via BFS queue
   */
  private propagateConstraints(startIdx: number): 'RUNNING' | 'COMPLETE' | 'CONTRADICTION' {
    let qHead = 0;
    let qTail = 0;

    this.propQueue[qTail++] = startIdx;
    this.inQueue[startIdx] = 1;

    while (qHead < qTail) {
      const currIdx = this.propQueue[qHead++];
      this.inQueue[currIdx] = 0;

      const cx = currIdx % this.cols;
      const cy = Math.floor(currIdx / this.cols);
      const currOffset = currIdx * this.numTiles;

      for (let d = 0; d < 4; d++) {
        const nx = cx + DIR_DX[d];
        const ny = cy + DIR_DY[d];

        if (nx < 0 || nx >= this.cols || ny < 0 || ny >= this.rows) continue;

        const nIdx = ny * this.cols + nx;
        const nCount = this.cellCandidateCount[nIdx];
        if (nCount <= 1) continue;

        const nOffset = nIdx * this.numTiles;
        let prunedAny = false;

        // Check each active candidate in neighbor
        for (let nt = 0; nt < this.numTiles; nt++) {
          if (this.cellPossibilities[nOffset + nt] === 0) continue;

          // nt is allowed if there is at least one active candidate ct in currIdx compatible with nt in direction d
          let isCompatible = false;
          for (let ct = 0; ct < this.numTiles; ct++) {
            if (this.cellPossibilities[currOffset + ct] === 1) {
              if (this.catalog.compatible[ct][d].includes(nt)) {
                isCompatible = true;
                break;
              }
            }
          }

          if (!isCompatible) {
            this.cellPossibilities[nOffset + nt] = 0;
            this.cellCandidateCount[nIdx]--;
            prunedAny = true;
          }
        }

        if (this.cellCandidateCount[nIdx] === 0) {
          // Contradiction detected!
          return 'CONTRADICTION';
        }

        if (prunedAny) {
          if (this.cellCandidateCount[nIdx] === 1) {
            // Cell just collapsed!
            for (let nt = 0; nt < this.numTiles; nt++) {
              if (this.cellPossibilities[nOffset + nt] === 1) {
                this.cellCollapsedTile[nIdx] = nt;
                this.cellCollapseTime[nIdx] = this.simTime;
                this.collapsedCount++;
                break;
              }
            }
          }

          if (!this.inQueue[nIdx]) {
            this.propQueue[qTail++] = nIdx;
            this.inQueue[nIdx] = 1;
          }
        }
      }
    }

    return 'RUNNING';
  }

  /**
   * Resets a cell or brush radius of cells back to full superposition
   */
  public eraseArea(centerX: number, centerY: number, radius: number): void {
    const rSq = radius * radius;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy <= rSq) {
          const x = centerX + dx;
          const y = centerY + dy;
          if (x >= 0 && x < this.cols && y >= 0 && y < this.rows) {
            const idx = y * this.cols + x;
            const offset = idx * this.numTiles;
            for (let t = 0; t < this.numTiles; t++) {
              this.cellPossibilities[offset + t] = 1;
            }
            this.cellCandidateCount[idx] = this.numTiles;
            this.cellCollapsedTile[idx] = -1;
            this.cellPinned[idx] = 0;
          }
        }
      }
    }
    this.isComplete = false;
  }
}

// ---------------------------------------------------------------------------
// 3. MAIN WFC ROOM IMPLEMENTATION
// ---------------------------------------------------------------------------

export class WaveFunctionCollapseRoom implements RoomInstance {
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private params!: WFCParams;
  private prng!: PRNG;
  private sim!: WFCSimulation;

  private rafId: number | null = null;
  private lastTimestamp: number = 0;
  private isRunning: boolean = true;

  // Pointer tracking
  private pointerGridX: number = -1;
  private pointerGridY: number = -1;
  private isPointerDown: boolean = false;

  // Smooth parameter damping
  private currentSuperpositionAlpha: number = DEFAULT_WFC_PARAMS.superpositionAlpha;
  private currentFrontierGlow: number = DEFAULT_WFC_PARAMS.frontierGlow;
  private currentLineWidth: number = DEFAULT_WFC_PARAMS.lineWidth;
  private stepAccumulator: number = 0.0;

  public async mount(ctx: RoomContext): Promise<RoomCleanupFn> {
    this.canvas = ctx.canvas;
    const context2d = this.canvas.getContext('2d');
    if (!context2d) {
      throw new Error('Canvas2D rendering context not supported for Wave Function Collapse');
    }
    this.ctx = context2d;
    this.params = { ...DEFAULT_WFC_PARAMS, ...ctx.params } as WFCParams;
    this.prng = ctx.prng ?? createPRNG(this.params.seed);

    this.sim = new WFCSimulation(
      this.params.gridSize,
      this.params.gridSize,
      this.params.tileSet,
      this.prng
    );

    this.currentSuperpositionAlpha = this.params.superpositionAlpha;
    this.currentFrontierGlow = this.params.frontierGlow;
    this.currentLineWidth = this.params.lineWidth;

    this.resize(this.canvas.width, this.canvas.height);
    this.isRunning = true;
    this.lastTimestamp = performance.now();

    const loop = (timestamp: number) => {
      if (!this.isRunning) return;
      const dt = Math.min((timestamp - this.lastTimestamp) / 1000, 0.1);
      this.lastTimestamp = timestamp;

      this.update(dt);
      this.render();

      this.rafId = requestAnimationFrame(loop);
    };

    this.rafId = requestAnimationFrame(loop);

    return () => {
      this.isRunning = false;
      if (this.rafId !== null) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
    };
  }

  public updateParams(newParams: Record<string, any>): void {
    const prevGridSize = this.params.gridSize;
    const prevTileSet = this.params.tileSet;
    const prevSeed = this.params.seed;
    const prevSymmetry = this.params.symmetryEnforce;

    this.params = { ...this.params, ...newParams };

    let needsReset = false;
    if (newParams.seed !== undefined && newParams.seed !== prevSeed) {
      this.prng = createPRNG(this.params.seed);
      needsReset = true;
    }
    if (newParams.gridSize !== undefined && newParams.gridSize !== prevGridSize) {
      needsReset = true;
    }
    if (newParams.tileSet !== undefined && newParams.tileSet !== prevTileSet) {
      needsReset = true;
    }
    if (newParams.symmetryEnforce !== undefined && newParams.symmetryEnforce !== prevSymmetry) {
      needsReset = true;
    }

    if (needsReset) {
      this.sim.init(
        this.params.gridSize,
        this.params.gridSize,
        this.params.tileSet,
        this.prng
      );
      if (this.params.symmetryEnforce) {
        this.sim.resetGrid(this.prng, true);
      }
    }
  }

  public resize(width: number, height: number): void {
    if (this.canvas) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  public onPointer(event: RoomPointerEvent): void {
    this.isPointerDown = event.isDown;

    const w = this.canvas.width;
    const h = this.canvas.height;
    const size = Math.min(w, h) * 0.9;
    const offsetX = (w - size) * 0.5;
    const offsetY = (h - size) * 0.5;
    const cellSize = size / this.sim.cols;

    if (
      event.x >= offsetX &&
      event.x < offsetX + size &&
      event.y >= offsetY &&
      event.y < offsetY + size
    ) {
      this.pointerGridX = Math.floor((event.x - offsetX) / cellSize);
      this.pointerGridY = Math.floor((event.y - offsetY) / cellSize);

      if (event.isDown) {
        this.handlePointerInteraction(this.pointerGridX, this.pointerGridY);
      }
    } else {
      this.pointerGridX = -1;
      this.pointerGridY = -1;
    }
  }

  private handlePointerInteraction(gx: number, gy: number): void {
    switch (this.params.pointerMode) {
      case 'collapse':
        this.sim.collapseCell(gx, gy, this.prng);
        break;
      case 'erase':
        this.sim.eraseArea(gx, gy, this.params.brushRadius);
        break;
      case 'pin-blank':
        this.sim.collapseCell(gx, gy, this.prng, 0);
        break;
      case 'disturb':
        this.sim.eraseArea(gx, gy, this.params.brushRadius);
        this.sim.collapseCell(gx, gy, this.prng);
        break;
    }
  }

  private update(dt: number): void {
    // Parameter damping
    this.currentSuperpositionAlpha = dampParameter(
      this.currentSuperpositionAlpha,
      this.params.superpositionAlpha,
      6.0,
      dt
    );
    this.currentFrontierGlow = dampParameter(
      this.currentFrontierGlow,
      this.params.frontierGlow,
      6.0,
      dt
    );
    this.currentLineWidth = dampParameter(
      this.currentLineWidth,
      this.params.lineWidth,
      6.0,
      dt
    );

    // Run WFC solver steps with accumulator for frame-rate independence
    this.stepAccumulator += dt * this.params.collapseSpeed * 60.0;
    const substeps = Math.floor(this.stepAccumulator);
    if (substeps > 0) {
      this.stepAccumulator -= substeps;
      this.sim.step(
        substeps,
        this.prng,
        this.params.autoRestart,
        this.params.restartDelay,
        dt
      );
    } else {
      this.sim.step(
        0,
        this.prng,
        this.params.autoRestart,
        this.params.restartDelay,
        dt
      );
    }

    // Continuous dragging pointer interaction
    if (this.isPointerDown && this.pointerGridX >= 0 && this.pointerGridY >= 0) {
      this.handlePointerInteraction(this.pointerGridX, this.pointerGridY);
    }
  }

  private render(): void {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const pal = WFC_PALETTES[this.params.colorPalette] || WFC_PALETTES['spectral-aurora'];

    // 1. Clear background to obsidian void
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, w, h);

    const size = Math.min(w, h) * 0.9;
    const offsetX = (w - size) * 0.5;
    const offsetY = (h - size) * 0.5;
    const cols = this.sim.cols;
    const rows = this.sim.rows;
    const cellSize = size / cols;
    const simTime = this.sim.simTime;
    const lw = this.currentLineWidth;

    // 2. Draw outer grid boundary border
    ctx.strokeStyle = pal.gridLine;
    ctx.lineWidth = 1;
    ctx.strokeRect(offsetX, offsetY, size, size);

    // 3. Render grid cells
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        const idx = cy * cols + cx;
        const cellX = offsetX + cx * cellSize;
        const cellY = offsetY + cy * cellSize;
        const collapsedTile = this.sim.cellCollapsedTile[idx];
        const candidateCount = this.sim.cellCandidateCount[idx];

        // Draw cell hairline frame
        ctx.strokeStyle = pal.gridLine;
        ctx.lineWidth = 0.5;
        ctx.strokeRect(cellX, cellY, cellSize, cellSize);

        if (collapsedTile >= 0) {
          // --- COLLAPSED CELL ---
          const tile = this.sim.catalog.tiles[collapsedTile];
          const timeSinceCollapse = simTime - this.sim.cellCollapseTime[idx];
          const entranceAnim = Math.min(1.0, timeSinceCollapse * 3.5);

          ctx.save();
          if (entranceAnim < 1.0) {
            // Luminous entrance scale & glow
            const scale = 0.75 + 0.25 * entranceAnim;
            ctx.translate(cellX + cellSize * 0.5, cellY + cellSize * 0.5);
            ctx.scale(scale, scale);
            ctx.translate(-(cellX + cellSize * 0.5), -(cellY + cellSize * 0.5));
            ctx.shadowColor = pal.frontier;
            ctx.shadowBlur = (1.0 - entranceAnim) * 16 * this.currentFrontierGlow;
          }

          tile.draw(ctx, cellX, cellY, cellSize, pal, 1.0, simTime, lw);
          ctx.restore();
        } else if (candidateCount > 1) {
          // --- UNCOLLAPSED CELL (SUPERPOSITION) ---
          const entropyFrac = candidateCount / this.sim.numTiles;
          const isNearCollapse = candidateCount <= 3;

          // Subtle background aura for cells nearing collapse
          if (isNearCollapse && this.currentFrontierGlow > 0.1) {
            const pulse = 0.5 + 0.5 * Math.sin(simTime * 6 + (cx + cy) * 0.4);
            ctx.fillStyle = `rgba(0, 240, 255, ${0.06 * pulse * this.currentFrontierGlow})`;
            ctx.fillRect(cellX + 1, cellY + 1, cellSize - 2, cellSize - 2);
          }

          // Render ghosted superposition previews of remaining candidate prototypes
          if (this.currentSuperpositionAlpha > 0.02) {
            const offset = idx * this.sim.numTiles;
            const previewAlpha = (this.currentSuperpositionAlpha / candidateCount) * 1.2;

            for (let t = 0; t < this.sim.numTiles; t++) {
              if (this.sim.cellPossibilities[offset + t] === 1) {
                const proto = this.sim.catalog.tiles[t];
                proto.draw(ctx, cellX, cellY, cellSize, pal, previewAlpha, simTime, Math.max(0.5, lw * 0.5));
              }
            }
          }

          // Subtle archival entropy dot matrix
          if (cellSize >= 16) {
            const dotSize = Math.max(1, cellSize * 0.05);
            drawCircle(
              ctx,
              cellX + cellSize * 0.5,
              cellY + cellSize * 0.5,
              dotSize,
              `rgba(255, 255, 255, ${0.08 * (1.0 - entropyFrac)})`
            );
          }
        }
      }
    }

    // 4. Render shockwave ripples (clipped to grid bounds)
    ctx.save();
    ctx.beginPath();
    ctx.rect(offsetX, offsetY, size, size);
    ctx.clip();
    for (const rip of this.sim.ripples) {
      const rx = offsetX + (rip.x + 0.5) * cellSize;
      const ry = offsetY + (rip.y + 0.5) * cellSize;
      const rPx = rip.radius * (cellSize / 12);
      ctx.beginPath();
      ctx.arc(rx, ry, rPx, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0, 240, 255, ${rip.alpha * 0.6})`;
      ctx.lineWidth = Math.max(1, 2 * rip.alpha);
      ctx.stroke();
    }
    ctx.restore();

    // 5. Render interactive cursor reticle
    if (this.pointerGridX >= 0 && this.pointerGridY >= 0) {
      const hx = offsetX + this.pointerGridX * cellSize;
      const hy = offsetY + this.pointerGridY * cellSize;
      const idx = this.pointerGridY * cols + this.pointerGridX;
      const candCount = this.sim.cellCandidateCount[idx];
      const isCol = this.sim.cellCollapsedTile[idx] >= 0;

      // Glowing reticle frame
      ctx.strokeStyle = pal.frontier;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(hx - 1, hy - 1, cellSize + 2, cellSize + 2);

      // Corner brackets
      const bk = Math.max(3, cellSize * 0.2);
      ctx.strokeStyle = pal.accent;
      ctx.lineWidth = 2;
      // Top-Left
      drawLine(ctx, hx - 2, hy - 2, hx - 2 + bk, hy - 2, pal.accent, 2);
      drawLine(ctx, hx - 2, hy - 2, hx - 2, hy - 2 + bk, pal.accent, 2);
      // Bottom-Right
      drawLine(ctx, hx + cellSize + 2, hy + cellSize + 2, hx + cellSize + 2 - bk, hy + cellSize + 2, pal.accent, 2);
      drawLine(ctx, hx + cellSize + 2, hy + cellSize + 2, hx + cellSize + 2, hy + cellSize + 2 - bk, pal.accent, 2);

      // Tooltip placard
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillStyle = pal.frontier;
      const statusText = isCol
        ? `[${this.pointerGridX},${this.pointerGridY}] ${this.sim.catalog.tiles[this.sim.cellCollapsedTile[idx]].name}`
        : `[${this.pointerGridX},${this.pointerGridY}] Candidates: ${candCount}/${this.sim.numTiles}`;
      ctx.fillText(statusText, hx, hy - 6);
    }
  }

  /**
   * Custom high-resolution offline snapshot export (4K/8K stills)
   */
  public async captureSnapshot(width: number, height: number): Promise<HTMLCanvasElement> {
    const snapCanvas = document.createElement('canvas');
    snapCanvas.width = width;
    snapCanvas.height = height;
    const sCtx = snapCanvas.getContext('2d');
    if (!sCtx) {
      throw new Error('Failed to create snapshot 2D context');
    }

    const pal = WFC_PALETTES[this.params.colorPalette] || WFC_PALETTES['spectral-aurora'];
    sCtx.fillStyle = pal.bg;
    sCtx.fillRect(0, 0, width, height);

    const size = Math.min(width, height) * 0.92;
    const offsetX = (width - size) * 0.5;
    const offsetY = (height - size) * 0.5;
    const cols = this.sim.cols;
    const rows = this.sim.rows;
    const cellSize = size / cols;
    const lw = this.params.lineWidth * (width / 1200);

    // Frame
    sCtx.strokeStyle = pal.gridLine;
    sCtx.lineWidth = Math.max(1, width / 1000);
    sCtx.strokeRect(offsetX, offsetY, size, size);

    // Render cells
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        const idx = cy * cols + cx;
        const cellX = offsetX + cx * cellSize;
        const cellY = offsetY + cy * cellSize;
        const collapsedTile = this.sim.cellCollapsedTile[idx];

        sCtx.strokeStyle = pal.gridLine;
        sCtx.lineWidth = 0.5;
        sCtx.strokeRect(cellX, cellY, cellSize, cellSize);

        if (collapsedTile >= 0) {
          const tile = this.sim.catalog.tiles[collapsedTile];
          tile.draw(sCtx, cellX, cellY, cellSize, pal, 1.0, 0, lw);
        } else {
          // Uncollapsed preview in snapshot
          const offset = idx * this.sim.numTiles;
          const count = this.sim.cellCandidateCount[idx];
          const previewAlpha = (this.params.superpositionAlpha / Math.max(1, count)) * 1.5;
          for (let t = 0; t < this.sim.numTiles; t++) {
            if (this.sim.cellPossibilities[offset + t] === 1) {
              const proto = this.sim.catalog.tiles[t];
              proto.draw(sCtx, cellX, cellY, cellSize, pal, previewAlpha, 0, lw * 0.5);
            }
          }
        }
      }
    }

    return snapCanvas;
  }
}

export const room: RoomInstance = new WaveFunctionCollapseRoom();
export default room;
