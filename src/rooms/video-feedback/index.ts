/**
 * Room 18: Video Feedback Loop (Multi-Pass Ping-Pong Framebuffer Feedback)
 * Curatorial Category: Psychedelic & Optical
 * Math Model: Analog Cathode-Ray Video Feedback with Parameterized Affine Transforms, Optical Aberration & LFO Drifts
 * Compute Engine: Three.js WebGL2 / WebGPURenderer Ping-Pong Framebuffers & High-Performance Dual-Canvas2D Fallback
 * Aesthetic Direction: Obsidian Archival Minimal (#090A0D Base)
 * 
 * Features:
 * - Real-time ping-pong framebuffer feedback simulating analog CRT / video camera feedback loops:
 *     F_t(x) = Decay * ToneGrade(Sample(F_{t-1}, R_θ · S · (x - c) + c + d + Distort(x)) + Injection(x, t)
 * - Parameterized spatial transformation: Zoom (S), Rotation (θ), Translation offset (d), Center pivot (c)
 * - Non-linear optical barrel / pincushion lens distortion: r' = r(1 + k_1 r^2 + k_2 r^4)
 * - Radial chromatic aberration / spectral dispersion: independent sampling of R, G, B channels with radial displacement
 * - Analog video color grading: continuous hue drift (ΔH), saturation boost, exponential decay persistence (0.90..0.999),
 *   and non-linear soft compression to prevent infinite blowout
 * - Injected geometric test patterns: 5-point Star, Pulsating Ring, Archimedean Spiral, Hexagon Polygon, Lissajous Knot, Crosshair
 * - Interactive pointer disturbance / light painting: cursor velocity creates continuous luminous ribbon strokes
 * - Auto-evolving LFOs (Low Frequency Oscillators) for hypnotic autonomous drifting zoom and rotation rhythms
 * - Real-time Web Audio API frequency analysis modulating core pulsing, rotation acceleration, and chromatic shimmer
 * - 8 Curated Canonical Presets: Infinite Tunnel, Fractal Spiral, CRT Phosphor, Kaleido Drift, Solar Corona, Quantum Lattice, Cyber Glitch, Abyssal Vortex
 * - 7 Curatorial Spectral Palettes: Spectral Aurora, Solar Plasma, Phosphor CRT, Cyber Neon, Obsidian Emerald, Cosmic Amethyst, Monochrome Void
 * - Custom high-resolution offline snapshot pass (captureSnapshot) for 4K/8K stills
 * - Complete resource disposal lifecycle
 */

import * as THREE from 'three';
import type {
  RoomInstance,
  RoomContext,
  RoomCleanupFn,
  RoomPointerEvent,
} from '../types';
import { createPRNG, type PRNG } from '../../lib/prng';
import { dampParameter } from '../../lib/state';
import { audioManager, type AudioManager, type AudioSourceType } from '../../lib/audio';

export type VideoFeedbackPreset =
  | 'infinite-tunnel'
  | 'fractal-spiral'
  | 'crt-phosphor'
  | 'kaleido-drift'
  | 'solar-corona'
  | 'quantum-lattice'
  | 'cyber-glitch'
  | 'abyssal-vortex';

export type VideoFeedbackPalette =
  | 'spectral-aurora'
  | 'solar-plasma'
  | 'phosphor-crt'
  | 'cyber-neon'
  | 'obsidian-emerald'
  | 'cosmic-amethyst'
  | 'monochrome-void';

export type InjectionShape =
  | 'star'
  | 'ring'
  | 'spiral'
  | 'polygon'
  | 'lissajous'
  | 'cross'
  | 'none';

export interface VideoFeedbackParams {
  seed: string;
  preset: VideoFeedbackPreset;
  zoom: number;                 // Spatial zoom factor S
  rotation: number;             // Rotation angle theta per frame (rad)
  decay: number;                // Frame persistence decay rate (0.90..0.999)
  hueShift: number;             // Hue drift rate per frame (-0.05..0.05)
  chromaticAberration: number;  // Radial color channel dispersion (0.0..0.05)
  distortion: number;           // Primary optical distortion k1 (-0.5..0.5)
  distortionK2: number;         // Secondary optical distortion k2 (-0.2..0.2)
  saturation: number;           // Color saturation multiplier (0.5..2.5)
  brightness: number;           // Exposure gain (0.5..2.0)
  contrast: number;             // Non-linear contrast curve (0.5..2.0)
  colorPalette: VideoFeedbackPalette;
  injectionShape: InjectionShape;
  injectionSize: number;
  injectionSpeed: number;
  injectionIntensity: number;
  brushRadius: number;
  brushIntensity: number;
  lfoZoom: number;              // Auto-evolving LFO zoom modulation amp
  lfoRotation: number;          // Auto-evolving LFO rotation modulation amp
  lfoSpeed: number;             // LFO oscillation rate
  audioSource: AudioSourceType;
  audioSensitivity: number;
}

export const DEFAULT_VIDEO_FEEDBACK_PARAMS: VideoFeedbackParams = {
  seed: '#00F0FF',
  preset: 'infinite-tunnel',
  zoom: 1.025,
  rotation: 0.015,
  decay: 0.978,
  hueShift: 0.008,
  chromaticAberration: 0.012,
  distortion: -0.05,
  distortionK2: 0.0,
  saturation: 1.15,
  brightness: 1.05,
  contrast: 1.10,
  colorPalette: 'spectral-aurora',
  injectionShape: 'ring',
  injectionSize: 0.09,
  injectionSpeed: 1.0,
  injectionIntensity: 0.85,
  brushRadius: 22,
  brushIntensity: 1.0,
  lfoZoom: 0.015,
  lfoRotation: 0.008,
  lfoSpeed: 0.5,
  audioSource: 'synth',
  audioSensitivity: 1.5,
};

// 8 Canonical Presets
export const VIDEO_FEEDBACK_PRESETS: Record<VideoFeedbackPreset, Partial<VideoFeedbackParams>> = {
  'infinite-tunnel': {
    zoom: 1.030,
    rotation: 0.004,
    decay: 0.980,
    hueShift: 0.005,
    chromaticAberration: 0.008,
    distortion: -0.04,
    distortionK2: 0.0,
    saturation: 1.15,
    brightness: 1.05,
    contrast: 1.10,
    injectionShape: 'ring',
    injectionSize: 0.08,
    injectionSpeed: 0.8,
    injectionIntensity: 0.85,
    lfoZoom: 0.020,
    lfoRotation: 0.005,
    colorPalette: 'spectral-aurora',
  },
  'fractal-spiral': {
    zoom: 1.028,
    rotation: 0.032,
    decay: 0.984,
    hueShift: 0.014,
    chromaticAberration: 0.018,
    distortion: 0.08,
    distortionK2: -0.02,
    saturation: 1.25,
    brightness: 1.08,
    contrast: 1.15,
    injectionShape: 'star',
    injectionSize: 0.10,
    injectionSpeed: 1.2,
    injectionIntensity: 0.95,
    lfoZoom: 0.015,
    lfoRotation: 0.012,
    colorPalette: 'cyber-neon',
  },
  'crt-phosphor': {
    zoom: 1.014,
    rotation: 0.002,
    decay: 0.968,
    hueShift: 0.0,
    chromaticAberration: 0.006,
    distortion: -0.14,
    distortionK2: 0.04,
    saturation: 1.30,
    brightness: 1.12,
    contrast: 1.20,
    injectionShape: 'cross',
    injectionSize: 0.12,
    injectionSpeed: 0.5,
    injectionIntensity: 1.10,
    lfoZoom: 0.008,
    lfoRotation: 0.003,
    colorPalette: 'phosphor-crt',
  },
  'kaleido-drift': {
    zoom: 0.982,
    rotation: -0.038,
    decay: 0.986,
    hueShift: 0.020,
    chromaticAberration: 0.025,
    distortion: 0.16,
    distortionK2: -0.04,
    saturation: 1.35,
    brightness: 1.05,
    contrast: 1.12,
    injectionShape: 'polygon',
    injectionSize: 0.11,
    injectionSpeed: 1.5,
    injectionIntensity: 0.90,
    lfoZoom: 0.025,
    lfoRotation: 0.018,
    colorPalette: 'cosmic-amethyst',
  },
  'solar-corona': {
    zoom: 1.042,
    rotation: 0.018,
    decay: 0.974,
    hueShift: 0.008,
    chromaticAberration: 0.010,
    distortion: -0.08,
    distortionK2: 0.01,
    saturation: 1.30,
    brightness: 1.15,
    contrast: 1.18,
    injectionShape: 'spiral',
    injectionSize: 0.10,
    injectionSpeed: 1.1,
    injectionIntensity: 1.00,
    lfoZoom: 0.018,
    lfoRotation: 0.009,
    colorPalette: 'solar-plasma',
  },
  'quantum-lattice': {
    zoom: 1.018,
    rotation: 0.055,
    decay: 0.988,
    hueShift: 0.016,
    chromaticAberration: 0.022,
    distortion: -0.20,
    distortionK2: 0.06,
    saturation: 1.20,
    brightness: 1.08,
    contrast: 1.22,
    injectionShape: 'lissajous',
    injectionSize: 0.12,
    injectionSpeed: 0.9,
    injectionIntensity: 0.88,
    lfoZoom: 0.012,
    lfoRotation: 0.015,
    colorPalette: 'obsidian-emerald',
  },
  'cyber-glitch': {
    zoom: 1.052,
    rotation: -0.025,
    decay: 0.962,
    hueShift: 0.032,
    chromaticAberration: 0.038,
    distortion: 0.24,
    distortionK2: -0.08,
    saturation: 1.45,
    brightness: 1.20,
    contrast: 1.25,
    injectionShape: 'star',
    injectionSize: 0.14,
    injectionSpeed: 2.2,
    injectionIntensity: 1.15,
    lfoZoom: 0.035,
    lfoRotation: 0.022,
    colorPalette: 'cyber-neon',
  },
  'abyssal-vortex': {
    zoom: 0.972,
    rotation: 0.042,
    decay: 0.982,
    hueShift: 0.012,
    chromaticAberration: 0.020,
    distortion: -0.28,
    distortionK2: 0.08,
    saturation: 0.90,
    brightness: 1.10,
    contrast: 1.30,
    injectionShape: 'spiral',
    injectionSize: 0.13,
    injectionSpeed: 1.4,
    injectionIntensity: 0.95,
    lfoZoom: 0.022,
    lfoRotation: 0.014,
    colorPalette: 'monochrome-void',
  },
};

// Curatorial Spectral Palettes
export interface PaletteStop {
  r: number;
  g: number;
  b: number;
}

export interface VideoFeedbackPaletteDef {
  name: string;
  stops: [PaletteStop, PaletteStop, PaletteStop, PaletteStop];
}

export const VIDEO_FEEDBACK_PALETTES: Record<VideoFeedbackPalette, VideoFeedbackPaletteDef> = {
  'spectral-aurora': {
    name: 'Spectral Aurora',
    stops: [
      { r: 0.035, g: 0.039, b: 0.051 }, // Obsidian Void
      { r: 0.0, g: 0.94, b: 1.0 },      // Electric Cyan #00F0FF
      { r: 0.66, g: 0.33, b: 0.97 },   // Royal Violet #A855F7
      { r: 0.0, g: 1.0, b: 0.62 },     // Phosphor Mint #00FF9D
    ],
  },
  'solar-plasma': {
    name: 'Solar Plasma',
    stops: [
      { r: 0.04, g: 0.02, b: 0.01 },   // Volcanic Void
      { r: 1.0, g: 0.58, b: 0.0 },     // Solar Amber #FF9500
      { r: 1.0, g: 0.16, b: 0.0 },     // Volcanic Crimson #FF2A00
      { r: 1.0, g: 0.84, b: 0.0 },     // Golden Flame #FFB800
    ],
  },
  'phosphor-crt': {
    name: 'Phosphor CRT',
    stops: [
      { r: 0.01, g: 0.03, b: 0.01 },   // CRT Black
      { r: 0.0, g: 0.85, b: 0.30 },    // P1 Vintage Green
      { r: 0.0, g: 1.0, b: 0.40 },     // P31 Phosphor Green #00FF66
      { r: 0.60, g: 1.0, b: 0.70 },    // Cathode Spark
    ],
  },
  'cyber-neon': {
    name: 'Cyber Neon',
    stops: [
      { r: 0.035, g: 0.039, b: 0.051 }, // Obsidian Void
      { r: 1.0, g: 0.0, b: 0.50 },     // Laser Magenta #FF007F
      { r: 0.0, g: 0.94, b: 1.0 },     // Electric Cyan #00F0FF
      { r: 0.47, g: 0.16, b: 0.79 },   // Ultraviolet #7928CA
    ],
  },
  'obsidian-emerald': {
    name: 'Obsidian Emerald',
    stops: [
      { r: 0.02, g: 0.04, b: 0.03 },   // Forest Void
      { r: 0.0, g: 0.90, b: 0.60 },    // Jade Green #00E599
      { r: 0.64, g: 0.90, b: 0.21 },   // Neon Lime #A3E635
      { r: 0.90, g: 1.0, b: 0.95 },    // Mint White
    ],
  },
  'cosmic-amethyst': {
    name: 'Cosmic Amethyst',
    stops: [
      { r: 0.04, g: 0.02, b: 0.08 },   // Void Purple
      { r: 0.58, g: 0.20, b: 0.92 },   // Royal Purple #9333EA
      { r: 0.93, g: 0.28, b: 0.60 },   // Radiant Magenta #EC4899
      { r: 0.95, g: 0.90, b: 1.0 },    // Starlight Opal
    ],
  },
  'monochrome-void': {
    name: 'Monochrome Void',
    stops: [
      { r: 0.035, g: 0.039, b: 0.051 }, // Obsidian Void #090A0D
      { r: 0.40, g: 0.45, b: 0.55 },   // Slate Grey #64748B
      { r: 0.80, g: 0.84, b: 0.90 },   // Silver Filament #CBD5E1
      { r: 1.0, g: 1.0, b: 1.0 },      // Diamond White
    ],
  },
};

// Shape mapping enum to integer
function shapeToId(shape: InjectionShape): number {
  switch (shape) {
    case 'star': return 1;
    case 'ring': return 2;
    case 'spiral': return 3;
    case 'polygon': return 4;
    case 'lissajous': return 5;
    case 'cross': return 6;
    case 'none':
    default:
      return 0;
  }
}

// Fullscreen Quad Vertex Shader
const QUAD_VERTEX_SHADER = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// Feedback Transformation Fragment Shader
const FEEDBACK_FRAGMENT_SHADER = `
precision highp float;
varying vec2 vUv;

uniform sampler2D uFeedbackTexture;
uniform vec2 uResolution;
uniform float uTime;
uniform float uZoom;
uniform float uRotation;
uniform vec2 uTranslation;
uniform float uDistortionK1;
uniform float uDistortionK2;
uniform float uDecay;
uniform float uHueShift;
uniform float uSaturation;
uniform float uBrightness;
uniform float uContrast;
uniform float uChromaticAberration;

// Injected cursor
uniform vec2 uPointerPos;
uniform vec2 uPointerPrev;
uniform float uPointerDown;
uniform float uBrushRadius;
uniform float uBrushIntensity;
uniform vec3 uBrushColor;

// Injected test pattern
uniform int uInjectionShape;
uniform float uInjectionSize;
uniform float uInjectionSpeed;
uniform float uInjectionIntensity;
uniform vec3 uPaletteColor0;
uniform vec3 uPaletteColor1;
uniform vec3 uPaletteColor2;
uniform vec3 uPaletteColor3;

// RGB <-> HSV helpers
vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

// Distance to line segment for smooth cursor brush
float distToSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / (dot(ba, ba) + 1.0e-5), 0.0, 1.0);
  return length(pa - ba * h);
}

// 2D Rotation
vec2 rotate2D(vec2 p, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}

void main() {
  vec2 uv = vUv;
  vec2 center = vec2(0.5, 0.5);
  float aspect = uResolution.x / max(uResolution.y, 1.0);

  // Center-relative coordinates with aspect correction
  vec2 p = uv - center;
  p.x *= aspect;

  // 1. Spatial Transformation: Rotation, Zoom, Translation
  p = rotate2D(p, uRotation);
  p *= (1.0 / max(uZoom, 0.001));
  p -= uTranslation;

  // 2. Optical Distortion: r' = r * (1 + k1*r^2 + k2*r^4)
  float r = length(p);
  float distFactor = 1.0 + uDistortionK1 * (r * r) + uDistortionK2 * (r * r * r * r);
  p *= distFactor;

  // Back to UV space
  p.x /= aspect;
  vec2 transformedUv = center + p;

  // 3. Chromatic Aberration sampling
  vec2 uvR = center + (transformedUv - center) * (1.0 + uChromaticAberration);
  vec2 uvG = transformedUv;
  vec2 uvB = center + (transformedUv - center) * (1.0 - uChromaticAberration);

  // Soft boundary edge fade to void (#090A0D)
  float edgeFade = smoothstep(0.0, 0.025, uvG.x) * smoothstep(1.0, 0.975, uvG.x) *
                   smoothstep(0.0, 0.025, uvG.y) * smoothstep(1.0, 0.975, uvG.y);

  vec3 voidColor = vec3(0.035, 0.039, 0.051); // #090A0D Obsidian Void

  vec4 colR = (uvR.x >= 0.0 && uvR.x <= 1.0 && uvR.y >= 0.0 && uvR.y <= 1.0) ? texture2D(uFeedbackTexture, uvR) : vec4(voidColor, 1.0);
  vec4 colG = (uvG.x >= 0.0 && uvG.x <= 1.0 && uvG.y >= 0.0 && uvG.y <= 1.0) ? texture2D(uFeedbackTexture, uvG) : vec4(voidColor, 1.0);
  vec4 colB = (uvB.x >= 0.0 && uvB.x <= 1.0 && uvB.y >= 0.0 && uvB.y <= 1.0) ? texture2D(uFeedbackTexture, uvB) : vec4(voidColor, 1.0);

  vec3 sampleColor = vec3(colR.r, colG.g, colB.b);

  // 4. Color Grading: Hue Shift, Saturation, Decay, Contrast, Brightness
  vec3 hsv = rgb2hsv(sampleColor);
  hsv.x = fract(hsv.x + uHueShift);
  hsv.y = clamp(hsv.y * uSaturation, 0.0, 1.0);
  vec3 graded = hsv2rgb(hsv);

  // Apply decay
  graded *= uDecay;

  // Apply contrast & brightness
  graded = (graded - 0.5) * uContrast + 0.5;
  graded *= uBrightness;
  graded = clamp(graded, 0.0, 2.0);

  // Apply boundary edge fade
  graded = mix(voidColor, graded, edgeFade);

  // 5. Input Injection (Cursor Stroke + Geometric Pattern)
  vec3 injection = vec3(0.0);

  // Injected Geometric Pattern at center
  if (uInjectionShape > 0 && uInjectionIntensity > 0.001) {
    vec2 patP = (uv - center);
    patP.x *= aspect;
    float patAngle = uTime * uInjectionSpeed;
    patP = rotate2D(patP, patAngle);
    float patDist = length(patP);
    float size = uInjectionSize;

    float patMask = 0.0;
    if (uInjectionShape == 1) {
      // Star (5-pointed)
      float a = atan(patP.y, patP.x);
      float starR = size * (0.6 + 0.4 * cos(5.0 * a));
      patMask = smoothstep(starR, starR * 0.7, patDist);
    } else if (uInjectionShape == 2) {
      // Pulsating Ring
      float ringR = size * (0.8 + 0.2 * sin(uTime * 2.0));
      patMask = smoothstep(size * 0.12, 0.0, abs(patDist - ringR));
    } else if (uInjectionShape == 3) {
      // Archimedean Spiral
      float a = atan(patP.y, patP.x) + 3.14159;
      float spiralR = (a / 6.28318) * size;
      float dSp = abs(mod(patDist - spiralR, size) - size * 0.5);
      patMask = smoothstep(size * 0.14, 0.0, dSp) * smoothstep(size * 2.5, 0.0, patDist);
    } else if (uInjectionShape == 4) {
      // Polygon (Hexagon)
      float a = atan(patP.y, patP.x);
      float hexR = size / cos(mod(a + 0.5236, 1.0472) - 0.5236);
      patMask = smoothstep(hexR, hexR * 0.85, patDist);
    } else if (uInjectionShape == 5) {
      // Lissajous Knot
      float tKnot = uTime * uInjectionSpeed;
      vec2 knotPos = vec2(sin(tKnot * 3.0), cos(tKnot * 2.0)) * size;
      float dKnot = length(patP - knotPos);
      patMask = smoothstep(size * 0.35, 0.0, dKnot);
    } else if (uInjectionShape == 6) {
      // Crosshair / Reticle
      float crossMask = smoothstep(size * 0.03, 0.0, abs(patP.x)) * smoothstep(size, 0.0, abs(patP.y)) +
                        smoothstep(size * 0.03, 0.0, abs(patP.y)) * smoothstep(size, 0.0, abs(patP.x));
      patMask = clamp(crossMask, 0.0, 1.0);
    }

    // Color gradient across palette
    float colorPhase = fract(uTime * 0.1 + patDist * 2.0);
    vec3 patColor = mix(uPaletteColor1, uPaletteColor2, colorPhase);
    if (colorPhase > 0.5) {
      patColor = mix(uPaletteColor2, uPaletteColor3, (colorPhase - 0.5) * 2.0);
    }
    injection += patColor * patMask * uInjectionIntensity;
  }

  // Pointer / Cursor disturbance
  if (uPointerDown > 0.5 && uBrushIntensity > 0.001) {
    vec2 pA = uPointerPrev;
    vec2 pB = uPointerPos;
    vec2 curP = uv * uResolution;
    float dist = distToSegment(curP, pA, pB);
    float brushMask = exp(- (dist * dist) / (2.0 * max(uBrushRadius * uBrushRadius, 1.0)));
    injection += uBrushColor * brushMask * uBrushIntensity;
  }

  // Screen blend injection with feedback
  vec3 finalColor = 1.0 - (1.0 - clamp(graded, 0.0, 1.0)) * (1.0 - clamp(injection, 0.0, 1.0));

  gl_FragColor = vec4(finalColor, 1.0);
}
`;

// Display Fragment Shader (Blits front render target to canvas)
const DISPLAY_FRAGMENT_SHADER = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTexture;
void main() {
  gl_FragColor = texture2D(uTexture, vUv);
}
`;

export class VideoFeedbackRoom implements RoomInstance {
  private canvas: HTMLCanvasElement | null = null;
  private ctx2d: CanvasRenderingContext2D | null = null;
  private renderer: THREE.WebGLRenderer | null = null;

  // Orthographic rendering scenes & materials
  private feedbackScene: THREE.Scene | null = null;
  private displayScene: THREE.Scene | null = null;
  private camera: THREE.OrthographicCamera | null = null;
  private feedbackMaterial: THREE.ShaderMaterial | null = null;
  private displayMaterial: THREE.ShaderMaterial | null = null;

  // Ping-pong render targets
  private readTarget: THREE.WebGLRenderTarget | null = null;
  private writeTarget: THREE.WebGLRenderTarget | null = null;

  // Offscreen Canvas2D fallback buffers
  private offscreenCanvasA: HTMLCanvasElement | null = null;
  private offscreenCanvasB: HTMLCanvasElement | null = null;
  private offCtxA: CanvasRenderingContext2D | null = null;
  private offCtxB: CanvasRenderingContext2D | null = null;

  private backendMode: 'webgl' | 'canvas2d' = 'webgl';

  private prng: PRNG = createPRNG('#00F0FF');
  private audio: AudioManager | null = null;

  private width = 800;
  private height = 600;
  private dpr = 1;
  private rafId: number | null = null;
  private lastTime = 0;
  private totalTime = 0;
  private lfoPhase = 0;

  // Parameters
  private params: VideoFeedbackParams = { ...DEFAULT_VIDEO_FEEDBACK_PARAMS };
  private targetParams: VideoFeedbackParams = { ...DEFAULT_VIDEO_FEEDBACK_PARAMS };

  // Pointer tracking
  private pointerX = -1000;
  private pointerY = -1000;
  private prevPointerX = -1000;
  private prevPointerY = -1000;
  private isPointerDown = false;
  private pointerHue = 0.5;

  private isMounted = false;

  /**
   * Mounts Room 18 to the DOM canvas.
   */
  public async mount(ctx: RoomContext): Promise<RoomCleanupFn> {
    this.canvas = ctx.canvas;
    this.dpr = Math.min(ctx.dpr || 1, 2.0);
    this.prng = ctx.prng || createPRNG(ctx.params.seed || DEFAULT_VIDEO_FEEDBACK_PARAMS.seed);
    this.audio = ctx.audio || audioManager;

    this.applyParams(ctx.params, true);

    const initialW = Math.max(ctx.canvas.clientWidth || ctx.canvas.width || 800, 320);
    const initialH = Math.max(ctx.canvas.clientHeight || ctx.canvas.height || 600, 320);
    this.width = initialW;
    this.height = initialH;

    // Check if WebGL is available
    let glSupported = false;
    try {
      const testCanvas = document.createElement('canvas');
      const gl = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl');
      glSupported = !!gl;
    } catch {
      glSupported = false;
    }

    if (glSupported) {
      try {
        this.initWebGL();
        this.backendMode = 'webgl';
      } catch (err) {
        console.warn('WebGL init failed in Room 18, falling back to Canvas2D:', err);
        this.initCanvas2D();
        this.backendMode = 'canvas2d';
      }
    } else {
      this.initCanvas2D();
      this.backendMode = 'canvas2d';
    }

    this.isMounted = true;
    this.lastTime = performance.now();
    this.totalTime = 0;
    this.lfoPhase = this.prng.nextFloat(0, Math.PI * 2);

    this.loop = this.loop.bind(this);
    this.rafId = requestAnimationFrame(this.loop);

    return () => {
      this.teardown();
    };
  }

  /**
   * Initializes WebGL scene, camera, materials, and ping-pong render targets.
   */
  private initWebGL(): void {
    if (!this.canvas) return;

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.renderer.setSize(this.width, this.height, false);
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.autoClear = false;

    // Orthographic camera for full-screen quad rendering
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quadGeo = new THREE.PlaneGeometry(2, 2);

    // Setup Ping-Pong Render Targets
    const targetW = Math.min(Math.round(this.width * this.dpr), 2048);
    const targetH = Math.min(Math.round(this.height * this.dpr), 2048);

    const targetOptions: THREE.RenderTargetOptions = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      stencilBuffer: false,
      depthBuffer: false,
    };

    this.readTarget = new THREE.WebGLRenderTarget(targetW, targetH, targetOptions);
    this.writeTarget = new THREE.WebGLRenderTarget(targetW, targetH, targetOptions);

    // Palette uniform initial values
    const palDef = VIDEO_FEEDBACK_PALETTES[this.params.colorPalette] || VIDEO_FEEDBACK_PALETTES['spectral-aurora'];
    const pStops = palDef.stops;

    // Feedback Shader Material
    this.feedbackMaterial = new THREE.ShaderMaterial({
      vertexShader: QUAD_VERTEX_SHADER,
      fragmentShader: FEEDBACK_FRAGMENT_SHADER,
      uniforms: {
        uFeedbackTexture: { value: this.readTarget.texture },
        uResolution: { value: new THREE.Vector2(targetW, targetH) },
        uTime: { value: 0.0 },
        uZoom: { value: this.params.zoom },
        uRotation: { value: this.params.rotation },
        uTranslation: { value: new THREE.Vector2(0.0, 0.0) },
        uDistortionK1: { value: this.params.distortion },
        uDistortionK2: { value: this.params.distortionK2 },
        uDecay: { value: this.params.decay },
        uHueShift: { value: this.params.hueShift },
        uSaturation: { value: this.params.saturation },
        uBrightness: { value: this.params.brightness },
        uContrast: { value: this.params.contrast },
        uChromaticAberration: { value: this.params.chromaticAberration },

        uPointerPos: { value: new THREE.Vector2(-1000, -1000) },
        uPointerPrev: { value: new THREE.Vector2(-1000, -1000) },
        uPointerDown: { value: 0.0 },
        uBrushRadius: { value: this.params.brushRadius * this.dpr },
        uBrushIntensity: { value: this.params.brushIntensity },
        uBrushColor: { value: new THREE.Vector3(pStops[1].r, pStops[1].g, pStops[1].b) },

        uInjectionShape: { value: shapeToId(this.params.injectionShape) },
        uInjectionSize: { value: this.params.injectionSize },
        uInjectionSpeed: { value: this.params.injectionSpeed },
        uInjectionIntensity: { value: this.params.injectionIntensity },
        uPaletteColor0: { value: new THREE.Vector3(pStops[0].r, pStops[0].g, pStops[0].b) },
        uPaletteColor1: { value: new THREE.Vector3(pStops[1].r, pStops[1].g, pStops[1].b) },
        uPaletteColor2: { value: new THREE.Vector3(pStops[2].r, pStops[2].g, pStops[2].b) },
        uPaletteColor3: { value: new THREE.Vector3(pStops[3].r, pStops[3].g, pStops[3].b) },
      },
      depthWrite: false,
      depthTest: false,
    });

    this.feedbackScene = new THREE.Scene();
    this.feedbackScene.add(new THREE.Mesh(quadGeo, this.feedbackMaterial));

    // Display Blit Material
    this.displayMaterial = new THREE.ShaderMaterial({
      vertexShader: QUAD_VERTEX_SHADER,
      fragmentShader: DISPLAY_FRAGMENT_SHADER,
      uniforms: {
        uTexture: { value: this.readTarget.texture },
      },
      depthWrite: false,
      depthTest: false,
    });

    this.displayScene = new THREE.Scene();
    this.displayScene.add(new THREE.Mesh(quadGeo, this.displayMaterial));

    // Prime render targets with void color
    this.clearFeedback();
  }

  /**
   * Initializes Canvas2D fallback pipeline for software environments.
   */
  private initCanvas2D(): void {
    if (!this.canvas) return;
    this.ctx2d = this.canvas.getContext('2d');
    if (this.ctx2d) {
      this.canvas.width = Math.round(this.width * this.dpr);
      this.canvas.height = Math.round(this.height * this.dpr);
    }

    const w = Math.min(Math.round(this.width), 960);
    const h = Math.min(Math.round(this.height), 720);

    if (typeof document !== 'undefined') {
      this.offscreenCanvasA = document.createElement('canvas');
      this.offscreenCanvasA.width = w;
      this.offscreenCanvasA.height = h;
      this.offCtxA = this.offscreenCanvasA.getContext('2d');

      this.offscreenCanvasB = document.createElement('canvas');
      this.offscreenCanvasB.width = w;
      this.offscreenCanvasB.height = h;
      this.offCtxB = this.offscreenCanvasB.getContext('2d');
    }

    this.clearFeedback();
  }

  /**
   * Clears feedback buffer to obsidian void (#090A0D).
   */
  public clearFeedback(): void {
    if (this.renderer && this.readTarget && this.writeTarget) {
      const clearColor = new THREE.Color(0.035, 0.039, 0.051);
      this.renderer.setRenderTarget(this.readTarget);
      this.renderer.setClearColor(clearColor, 1.0);
      this.renderer.clear();

      this.renderer.setRenderTarget(this.writeTarget);
      this.renderer.setClearColor(clearColor, 1.0);
      this.renderer.clear();

      this.renderer.setRenderTarget(null);
    }

    if (this.offCtxA && this.offscreenCanvasA) {
      this.offCtxA.fillStyle = '#090A0D';
      this.offCtxA.fillRect(0, 0, this.offscreenCanvasA.width, this.offscreenCanvasA.height);
    }
    if (this.offCtxB && this.offscreenCanvasB) {
      this.offCtxB.fillStyle = '#090A0D';
      this.offCtxB.fillRect(0, 0, this.offscreenCanvasB.width, this.offscreenCanvasB.height);
    }
    if (this.ctx2d && this.canvas) {
      this.ctx2d.fillStyle = '#090A0D';
      this.ctx2d.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  /**
   * Animation update & render tick loop.
   */
  private loop(currentTime: number): void {
    if (!this.isMounted) return;

    const rawDt = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;
    const dt = Math.min(rawDt, 0.064);

    this.totalTime += dt;
    this.lfoPhase += dt * this.params.lfoSpeed;

    this.dampParameters(dt);

    if (this.backendMode === 'webgl' && this.renderer && this.feedbackScene && this.displayScene && this.camera && this.readTarget && this.writeTarget) {
      this.renderWebGL(dt);
    } else {
      this.renderCanvas2D(dt);
    }

    // Advance pointer trail
    this.prevPointerX = this.pointerX;
    this.prevPointerY = this.pointerY;

    this.rafId = requestAnimationFrame(this.loop);
  }

  /**
   * Smoothly damps active parameters toward target parameters.
   */
  private dampParameters(dt: number): void {
    const lambda = 8.0;
    this.params.zoom = dampParameter(this.params.zoom, this.targetParams.zoom, lambda, dt);
    this.params.rotation = dampParameter(this.params.rotation, this.targetParams.rotation, lambda, dt);
    this.params.decay = dampParameter(this.params.decay, this.targetParams.decay, lambda, dt);
    this.params.hueShift = dampParameter(this.params.hueShift, this.targetParams.hueShift, lambda, dt);
    this.params.chromaticAberration = dampParameter(this.params.chromaticAberration, this.targetParams.chromaticAberration, lambda, dt);
    this.params.distortion = dampParameter(this.params.distortion, this.targetParams.distortion, lambda, dt);
    this.params.distortionK2 = dampParameter(this.params.distortionK2, this.targetParams.distortionK2, lambda, dt);
    this.params.saturation = dampParameter(this.params.saturation, this.targetParams.saturation, lambda, dt);
    this.params.brightness = dampParameter(this.params.brightness, this.targetParams.brightness, lambda, dt);
    this.params.contrast = dampParameter(this.params.contrast, this.targetParams.contrast, lambda, dt);
    this.params.injectionSize = dampParameter(this.params.injectionSize, this.targetParams.injectionSize, lambda, dt);
    this.params.injectionSpeed = dampParameter(this.params.injectionSpeed, this.targetParams.injectionSpeed, lambda, dt);
    this.params.injectionIntensity = dampParameter(this.params.injectionIntensity, this.targetParams.injectionIntensity, lambda, dt);
    this.params.brushRadius = dampParameter(this.params.brushRadius, this.targetParams.brushRadius, lambda, dt);
    this.params.brushIntensity = dampParameter(this.params.brushIntensity, this.targetParams.brushIntensity, lambda, dt);
    this.params.lfoZoom = dampParameter(this.params.lfoZoom, this.targetParams.lfoZoom, lambda, dt);
    this.params.lfoRotation = dampParameter(this.params.lfoRotation, this.targetParams.lfoRotation, lambda, dt);
    this.params.lfoSpeed = dampParameter(this.params.lfoSpeed, this.targetParams.lfoSpeed, lambda, dt);
    this.params.audioSensitivity = dampParameter(this.params.audioSensitivity, this.targetParams.audioSensitivity, lambda, dt);
  }

  /**
   * Evaluates audio frequency reactivity bands.
   */
  private getAudioReactivity(): { bassMod: number; midMod: number; trebleMod: number; transient: boolean } {
    if (!this.audio || this.params.audioSource === 'none') {
      return { bassMod: 0, midMod: 0, trebleMod: 0, transient: false };
    }
    const sens = this.params.audioSensitivity;
    const bass = this.audio.getBass() * sens;
    const mid = this.audio.getMid() * sens;
    const treble = this.audio.getTreble() * sens;
    const transient = this.audio.isTransientDetected();

    return { bassMod: bass, midMod: mid, trebleMod: treble, transient };
  }

  /**
   * Renders one WebGL feedback ping-pong iteration and blits to canvas.
   */
  private renderWebGL(_dt: number): void {
    if (!this.renderer || !this.feedbackMaterial || !this.displayMaterial || !this.readTarget || !this.writeTarget || !this.feedbackScene || !this.displayScene || !this.camera) {
      return;
    }

    const { bassMod, midMod, trebleMod, transient } = this.getAudioReactivity();

    // Auto-evolving LFO modulations
    const lfoZoomMod = this.params.lfoZoom * Math.sin(this.lfoPhase * 1.3);
    const lfoRotMod = this.params.lfoRotation * Math.sin(this.lfoPhase * 1.7 + 0.8);
    const lfoTransX = 0.008 * Math.sin(this.lfoPhase * 0.9);
    const lfoTransY = 0.008 * Math.cos(this.lfoPhase * 1.1);

    const effectiveZoom = this.params.zoom + lfoZoomMod + bassMod * 0.04;
    const effectiveRotation = this.params.rotation + lfoRotMod + midMod * 0.015;
    const effectiveChromatic = this.params.chromaticAberration + trebleMod * 0.015;
    const effectiveInjectionIntensity = this.params.injectionIntensity * (transient ? 1.4 : 1.0);

    const uniforms = this.feedbackMaterial.uniforms;
    uniforms.uFeedbackTexture.value = this.readTarget.texture;
    uniforms.uTime.value = this.totalTime;
    uniforms.uZoom.value = effectiveZoom;
    uniforms.uRotation.value = effectiveRotation;
    uniforms.uTranslation.value.set(lfoTransX, lfoTransY);
    uniforms.uDistortionK1.value = this.params.distortion;
    uniforms.uDistortionK2.value = this.params.distortionK2;
    uniforms.uDecay.value = this.params.decay;
    uniforms.uHueShift.value = this.params.hueShift;
    uniforms.uSaturation.value = this.params.saturation;
    uniforms.uBrightness.value = this.params.brightness;
    uniforms.uContrast.value = this.params.contrast;
    uniforms.uChromaticAberration.value = effectiveChromatic;

    // Pointer uniforms (convert to pixel coordinates matching render target)
    const targetW = this.readTarget.width;
    const targetH = this.readTarget.height;
    const scaleX = targetW / this.width;
    const scaleY = targetH / this.height;

    uniforms.uPointerPos.value.set(this.pointerX * scaleX, (this.height - this.pointerY) * scaleY);
    uniforms.uPointerPrev.value.set(
      this.prevPointerX >= 0 ? this.prevPointerX * scaleX : this.pointerX * scaleX,
      this.prevPointerY >= 0 ? (this.height - this.prevPointerY) * scaleY : (this.height - this.pointerY) * scaleY
    );
    uniforms.uPointerDown.value = this.isPointerDown ? 1.0 : 0.0;
    uniforms.uBrushRadius.value = this.params.brushRadius * this.dpr;
    uniforms.uBrushIntensity.value = this.params.brushIntensity;

    // Injected shape & palette
    uniforms.uInjectionShape.value = shapeToId(this.params.injectionShape);
    uniforms.uInjectionSize.value = this.params.injectionSize;
    uniforms.uInjectionSpeed.value = this.params.injectionSpeed;
    uniforms.uInjectionIntensity.value = effectiveInjectionIntensity;

    const palDef = VIDEO_FEEDBACK_PALETTES[this.params.colorPalette] || VIDEO_FEEDBACK_PALETTES['spectral-aurora'];
    const pStops = palDef.stops;
    uniforms.uPaletteColor0.value.set(pStops[0].r, pStops[0].g, pStops[0].b);
    uniforms.uPaletteColor1.value.set(pStops[1].r, pStops[1].g, pStops[1].b);
    uniforms.uPaletteColor2.value.set(pStops[2].r, pStops[2].g, pStops[2].b);
    uniforms.uPaletteColor3.value.set(pStops[3].r, pStops[3].g, pStops[3].b);

    // Pointer stroke color cycle
    this.pointerHue = (this.pointerHue + 0.005) % 1.0;
    uniforms.uBrushColor.value.set(pStops[2].r, pStops[2].g, pStops[2].b);

    // Pass 1: Render feedback transformation to writeTarget
    this.renderer.setRenderTarget(this.writeTarget);
    this.renderer.render(this.feedbackScene, this.camera);

    // Pass 2: Blit writeTarget to screen canvas
    this.displayMaterial.uniforms.uTexture.value = this.writeTarget.texture;
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.displayScene, this.camera);

    // Ping-pong swap
    const temp = this.readTarget;
    this.readTarget = this.writeTarget;
    this.writeTarget = temp;
  }

  /**
   * High-performance Canvas2D dual-buffer fallback rendering.
   */
  private renderCanvas2D(_dt: number): void {
    if (!this.ctx2d || !this.canvas || !this.offCtxA || !this.offCtxB || !this.offscreenCanvasA || !this.offscreenCanvasB) {
      return;
    }

    const srcCanvas = this.offscreenCanvasA;
    const dstCtx = this.offCtxB;
    const w = srcCanvas.width;
    const h = srcCanvas.height;
    const cx = w * 0.5;
    const cy = h * 0.5;

    const { bassMod, midMod } = this.getAudioReactivity();
    const lfoZoomMod = this.params.lfoZoom * Math.sin(this.lfoPhase * 1.3);
    const lfoRotMod = this.params.lfoRotation * Math.sin(this.lfoPhase * 1.7 + 0.8);
    const effectiveZoom = Math.max(0.85, this.params.zoom + lfoZoomMod + bassMod * 0.04);
    const effectiveRotation = this.params.rotation + lfoRotMod + midMod * 0.015;

    // 1. Darken background slightly for decay persistence
    dstCtx.fillStyle = `rgba(9, 10, 13, ${1.0 - this.params.decay * 0.98})`;
    dstCtx.fillRect(0, 0, w, h);

    // 2. Draw transformed previous frame with zoom and rotation
    dstCtx.save();
    dstCtx.translate(cx, cy);
    dstCtx.rotate(effectiveRotation);
    dstCtx.scale(effectiveZoom, effectiveZoom);
    dstCtx.globalAlpha = Math.min(1.0, this.params.decay * 1.01);
    dstCtx.drawImage(srcCanvas, -cx, -cy, w, h);
    dstCtx.restore();

    // 3. Draw injected seed shape
    if (this.params.injectionShape !== 'none' && this.params.injectionIntensity > 0.01) {
      const palDef = VIDEO_FEEDBACK_PALETTES[this.params.colorPalette] || VIDEO_FEEDBACK_PALETTES['spectral-aurora'];
      const pColor = palDef.stops[1];
      const strokeStyle = `rgb(${Math.round(pColor.r * 255)}, ${Math.round(pColor.g * 255)}, ${Math.round(pColor.b * 255)})`;

      dstCtx.save();
      dstCtx.translate(cx, cy);
      dstCtx.rotate(this.totalTime * this.params.injectionSpeed);
      dstCtx.strokeStyle = strokeStyle;
      dstCtx.lineWidth = 2.5;
      dstCtx.globalAlpha = Math.min(1.0, this.params.injectionIntensity);

      const size = this.params.injectionSize * Math.min(w, h);

      if (this.params.injectionShape === 'ring') {
        dstCtx.beginPath();
        dstCtx.arc(0, 0, size, 0, Math.PI * 2);
        dstCtx.stroke();
      } else if (this.params.injectionShape === 'star') {
        dstCtx.beginPath();
        for (let i = 0; i < 10; i++) {
          const r = i % 2 === 0 ? size : size * 0.5;
          const a = (i / 10) * Math.PI * 2;
          const x = Math.cos(a) * r;
          const y = Math.sin(a) * r;
          if (i === 0) dstCtx.moveTo(x, y);
          else dstCtx.lineTo(x, y);
        }
        dstCtx.closePath();
        dstCtx.stroke();
      } else if (this.params.injectionShape === 'cross') {
        dstCtx.beginPath();
        dstCtx.moveTo(-size, 0); dstCtx.lineTo(size, 0);
        dstCtx.moveTo(0, -size); dstCtx.lineTo(0, size);
        dstCtx.stroke();
      } else {
        dstCtx.strokeRect(-size * 0.5, -size * 0.5, size, size);
      }
      dstCtx.restore();
    }

    // 4. Draw pointer strokes
    if (this.isPointerDown && this.pointerX >= 0 && this.prevPointerX >= 0) {
      const scaleX = w / this.width;
      const scaleY = h / this.height;
      const x1 = this.prevPointerX * scaleX;
      const y1 = this.prevPointerY * scaleY;
      const x2 = this.pointerX * scaleX;
      const y2 = this.pointerY * scaleY;

      const palDef = VIDEO_FEEDBACK_PALETTES[this.params.colorPalette] || VIDEO_FEEDBACK_PALETTES['spectral-aurora'];
      const pColor = palDef.stops[2];

      dstCtx.save();
      dstCtx.strokeStyle = `rgba(${Math.round(pColor.r * 255)}, ${Math.round(pColor.g * 255)}, ${Math.round(pColor.b * 255)}, 0.85)`;
      dstCtx.lineWidth = this.params.brushRadius * scaleX * 0.8;
      dstCtx.lineCap = 'round';
      dstCtx.beginPath();
      dstCtx.moveTo(x1, y1);
      dstCtx.lineTo(x2, y2);
      dstCtx.stroke();
      dstCtx.restore();
    }

    // 5. Blit to main display canvas
    this.ctx2d.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx2d.drawImage(this.offscreenCanvasB, 0, 0, this.canvas.width, this.canvas.height);

    // Swap offscreen canvases
    const tempCanvas = this.offscreenCanvasA;
    const tempCtx = this.offCtxA;
    this.offscreenCanvasA = this.offscreenCanvasB;
    this.offCtxA = this.offCtxB;
    this.offscreenCanvasB = tempCanvas;
    this.offCtxB = tempCtx;
  }

  /**
   * Handles user parameter updates.
   */
  public updateParams(newParams: Record<string, any>): void {
    this.applyParams(newParams, false);
  }

  /**
   * Applies and merges parameters.
   */
  private applyParams(newParams: Record<string, any>, instant: boolean): void {
    if (!newParams) return;

    if (newParams.preset && newParams.preset !== this.targetParams.preset && VIDEO_FEEDBACK_PRESETS[newParams.preset as VideoFeedbackPreset]) {
      const presetDef = VIDEO_FEEDBACK_PRESETS[newParams.preset as VideoFeedbackPreset];
      Object.assign(this.targetParams, presetDef);
      this.targetParams.preset = newParams.preset as VideoFeedbackPreset;
      if (instant) {
        Object.assign(this.params, presetDef);
        this.params.preset = newParams.preset as VideoFeedbackPreset;
      }
    }

    for (const [key, value] of Object.entries(newParams)) {
      if (key in this.targetParams && value !== undefined) {
        (this.targetParams as any)[key] = value;
        if (instant) {
          (this.params as any)[key] = value;
        }
      }
    }
  }

  /**
   * Resizes viewport and render targets.
   */
  public resize(width: number, height: number): void {
    this.width = Math.max(width, 320);
    this.height = Math.max(height, 320);

    if (this.canvas) {
      this.canvas.width = Math.round(this.width * this.dpr);
      this.canvas.height = Math.round(this.height * this.dpr);
    }

    if (this.renderer) {
      this.renderer.setSize(this.width, this.height, false);
      this.renderer.setPixelRatio(this.dpr);
    }

    const targetW = Math.min(Math.round(this.width * this.dpr), 2048);
    const targetH = Math.min(Math.round(this.height * this.dpr), 2048);

    if (this.readTarget && this.writeTarget) {
      this.readTarget.setSize(targetW, targetH);
      this.writeTarget.setSize(targetW, targetH);
    }

    if (this.feedbackMaterial) {
      this.feedbackMaterial.uniforms.uResolution.value.set(targetW, targetH);
    }

    if (this.offscreenCanvasA && this.offscreenCanvasB) {
      this.offscreenCanvasA.width = Math.min(Math.round(this.width), 960);
      this.offscreenCanvasA.height = Math.min(Math.round(this.height), 720);
      this.offscreenCanvasB.width = Math.min(Math.round(this.width), 960);
      this.offscreenCanvasB.height = Math.min(Math.round(this.height), 720);
    }
  }

  /**
   * Handles pointer input events for light painting disturbance.
   */
  public onPointer(event: RoomPointerEvent): void {
    if (event.type === 'down') {
      this.isPointerDown = true;
      this.pointerX = event.x;
      this.pointerY = event.y;
      this.prevPointerX = event.x;
      this.prevPointerY = event.y;
    } else if (event.type === 'move') {
      this.pointerX = event.x;
      this.pointerY = event.y;
      this.isPointerDown = event.isDown;
    } else if (event.type === 'up' || event.type === 'leave') {
      this.isPointerDown = false;
      this.pointerX = -1000;
      this.pointerY = -1000;
      this.prevPointerX = -1000;
      this.prevPointerY = -1000;
    }
  }

  /**
   * Captures high-resolution offline snapshot.
   */
  public async captureSnapshot(width: number, height: number): Promise<HTMLCanvasElement> {
    const snapCanvas = document.createElement('canvas');
    snapCanvas.width = width;
    snapCanvas.height = height;
    const snapCtx = snapCanvas.getContext('2d');

    if (!snapCtx) return snapCanvas;

    if (this.renderer && this.readTarget) {
      // Copy current read target directly to snapshot canvas
      const offRenderer = new THREE.WebGLRenderer({
        canvas: snapCanvas,
        antialias: true,
        preserveDrawingBuffer: true,
      });
      offRenderer.setSize(width, height, false);

      const quadGeo = new THREE.PlaneGeometry(2, 2);
      const snapMat = new THREE.ShaderMaterial({
        vertexShader: QUAD_VERTEX_SHADER,
        fragmentShader: DISPLAY_FRAGMENT_SHADER,
        uniforms: {
          uTexture: { value: this.readTarget.texture },
        },
      });

      const snapScene = new THREE.Scene();
      snapScene.add(new THREE.Mesh(quadGeo, snapMat));
      const snapCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

      offRenderer.render(snapScene, snapCam);

      snapMat.dispose();
      quadGeo.dispose();
      offRenderer.dispose();
    } else if (this.offscreenCanvasA) {
      snapCtx.drawImage(this.offscreenCanvasA, 0, 0, width, height);
    } else {
      snapCtx.fillStyle = '#090A0D';
      snapCtx.fillRect(0, 0, width, height);
    }

    return snapCanvas;
  }

  /**
   * Complete resource teardown and memory cleanup.
   */
  private teardown(): void {
    this.isMounted = false;

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    if (this.feedbackMaterial) {
      this.feedbackMaterial.dispose();
      this.feedbackMaterial = null;
    }
    if (this.displayMaterial) {
      this.displayMaterial.dispose();
      this.displayMaterial = null;
    }
    if (this.readTarget) {
      this.readTarget.dispose();
      this.readTarget = null;
    }
    if (this.writeTarget) {
      this.writeTarget.dispose();
      this.writeTarget = null;
    }
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }

    this.feedbackScene = null;
    this.displayScene = null;
    this.camera = null;
    this.offscreenCanvasA = null;
    this.offscreenCanvasB = null;
    this.offCtxA = null;
    this.offCtxB = null;
    this.canvas = null;
    this.ctx2d = null;
  }
}

export const room = new VideoFeedbackRoom();
export default room;
