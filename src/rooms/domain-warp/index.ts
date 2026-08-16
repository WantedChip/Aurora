/**
 * Room 02: Domain-Warped Noise
 * Curatorial Category: Field & Flow
 * Math Model: Iterative fBm Coordinate Displacement (Inigo Quilez Formulation)
 * Compute Engine: Three.js TSL Fragment Shader (WebGPU WGSL / WebGL2 Fallback)
 * Aesthetic Direction: Obsidian Archival Minimal
 * 
 * Features:
 * - Real-time multi-layered fractional Brownian motion (fBm) with recursive domain displacement
 * - Authored in Three Shading Language (TSL) with full cross-backend compilation
 * - Smooth exponential parameter damping and interactive cursor vortex displacement
 * - 5 Curatorial Spectral Palettes (Aurora Teal, Solar Magma, Spectral Abyss, Obsidian Marble, Iridescent Pearl)
 * - Custom high-resolution offline snapshot pass for 4K/8K stills
 * - Complete resource disposal lifecycle
 */

import * as THREE from 'three/webgpu';
import {
  uniform,
  vec2,
  vec4,
  float,
  sin,
  cos,
  uv,
  mix,
  length,
  dot,
  fract,
  floor,
  clamp,
  tslFn,
} from 'three/tsl';

import type {
  RoomInstance,
  RoomContext,
  RoomCleanupFn,
  RoomPointerEvent,
} from '../types';
import { createPRNG, type PRNG } from '../../lib/prng';
import { dampParameter } from '../../lib/state';

export interface DomainWarpParams {
  seed: string;
  warpIntensity: number;
  frequency: number;
  colorSpread: number;
  animSpeed: number;
  distortionAngle: number;
  mouseInfluence: number;
  colorPalette: 'aurora-teal' | 'solar-magma' | 'spectral-abyss' | 'obsidian-marble' | 'iridescent-pearl';
}

export const DEFAULT_DOMAIN_WARP_PARAMS: DomainWarpParams = {
  seed: '#E24991',
  warpIntensity: 1.8,
  frequency: 2.2,
  colorSpread: 1.4,
  animSpeed: 0.25,
  distortionAngle: 0.8,
  mouseInfluence: 1.2,
  colorPalette: 'aurora-teal',
};

// Curatorial Color Palettes for Domain Warping (4 Layer Nodes: Void, Primary, Accent, Crest)
interface PaletteDef {
  colorA: [number, number, number]; // Dark Void / Shadow Base
  colorB: [number, number, number]; // Primary Flow Tone
  colorC: [number, number, number]; // Spectral Highlight
  colorD: [number, number, number]; // Apex Crest / Starlight White
}

const DOMAIN_PALETTES: Record<string, PaletteDef> = {
  'aurora-teal': {
    colorA: [0.035, 0.039, 0.051], // #090A0D Void Obsidian
    colorB: [0.0, 0.75, 0.85],     // Electric Cyan (#00F0FF)
    colorC: [0.0, 0.95, 0.55],     // Phosphor Mint (#00FF9D)
    colorD: [0.95, 0.98, 1.0],     // Starlight White
  },
  'solar-magma': {
    colorA: [0.04, 0.02, 0.01],    // Dark Magma Void
    colorB: [0.95, 0.45, 0.0],     // Radiant Solar Amber
    colorC: [1.0, 0.18, 0.05],     // Volcanic Flare
    colorD: [1.0, 0.92, 0.65],     // Solar Gold Crest
  },
  'spectral-abyss': {
    colorA: [0.03, 0.02, 0.06],    // Cosmic Void
    colorB: [0.55, 0.2, 0.95],     // Royal Violet (#A855F7)
    colorC: [0.98, 0.15, 0.45],    // Laser Crimson (#FF3366)
    colorD: [0.2, 0.85, 1.0],      // Cyan Halo
  },
  'obsidian-marble': {
    colorA: [0.025, 0.027, 0.035], // Obsidian Deep Void
    colorB: [0.25, 0.28, 0.35],    // Marble Slate
    colorC: [0.55, 0.60, 0.70],    // Silver Vein
    colorD: [0.96, 0.97, 0.99],    // Polished Quartz White
  },
  'iridescent-pearl': {
    colorA: [0.04, 0.05, 0.06],    // Abyssal Slate
    colorB: [0.15, 0.75, 0.65],    // Seafoam Jade
    colorC: [0.85, 0.45, 0.80],    // Amethyst Luster
    colorD: [0.98, 0.95, 0.85],    // Golden Pearl
  },
};

export class DomainWarpRoom implements RoomInstance {
  private canvas: HTMLCanvasElement | null = null;
  private renderer: THREE.WebGPURenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.OrthographicCamera | null = null;
  private mesh: THREE.Mesh | null = null;
  private material: THREE.MeshBasicNodeMaterial | null = null;

  private prng: PRNG = createPRNG('#E24991');
  private width = 0;
  private height = 0;
  private dpr = 1;
  private rafId: number | null = null;
  private lastTime = 0;
  private totalTime = 0;

  // Active Parameters
  private params: DomainWarpParams = { ...DEFAULT_DOMAIN_WARP_PARAMS };

  // Target Parameter Values for Smooth Exponential Lerping
  private targetParams: DomainWarpParams = { ...DEFAULT_DOMAIN_WARP_PARAMS };

  // TSL Uniform Nodes
  private uTime = uniform(0.0);
  private uResolution = uniform(new THREE.Vector2(800, 600));
  private uWarpIntensity = uniform(1.8);
  private uFrequency = uniform(2.2);
  private uColorSpread = uniform(1.4);
  private uAnimSpeed = uniform(0.25);
  private uDistortionAngle = uniform(0.8);
  private uMouse = uniform(new THREE.Vector2(-10.0, -10.0));
  private uMouseInfluence = uniform(1.2);
  private uSeedOffset = uniform(new THREE.Vector2(0.0, 0.0));

  private uColorA = uniform(new THREE.Color(0.035, 0.039, 0.051));
  private uColorB = uniform(new THREE.Color(0.0, 0.75, 0.85));
  private uColorC = uniform(new THREE.Color(0.0, 0.95, 0.55));
  private uColorD = uniform(new THREE.Color(0.95, 0.98, 1.0));

  // Pointer smoothing state
  private pointerX = -1000;
  private pointerY = -1000;
  private smoothedPointerX = -1000;
  private smoothedPointerY = -1000;
  private isPointerDown = false;
  private isMounted = false;
  private prefersReducedMotion = false;

  /**
   * Mounts the WebGPU/TSL domain warp simulation to the provided canvas.
   */
  public async mount(ctx: RoomContext): Promise<RoomCleanupFn> {
    this.canvas = ctx.canvas;
    this.dpr = ctx.dpr || 1;
    this.prng = ctx.prng || createPRNG(ctx.params.seed || DEFAULT_DOMAIN_WARP_PARAMS.seed);

    this.prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.applyParams(ctx.params, true);

    const initialW = Math.max(ctx.canvas.clientWidth || ctx.canvas.width || 800, 320);
    const initialH = Math.max(ctx.canvas.clientHeight || ctx.canvas.height || 600, 320);
    this.width = initialW;
    this.height = initialH;

    // Initialize WebGPURenderer (automatic WebGPU -> WebGL2 backend fallback)
    this.renderer = new THREE.WebGPURenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    });

    await this.renderer.init();

    this.renderer.setSize(this.width, this.height, false);
    this.renderer.setPixelRatio(this.dpr);

    // Build Scene & Fullscreen Orthographic Camera
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // Build Domain Warping TSL Shader Material
    this.material = this.buildTSLMaterial();

    const geometry = new THREE.PlaneGeometry(2, 2);
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.scene.add(this.mesh);

    this.isMounted = true;
    this.lastTime = performance.now();

    this.loop = this.loop.bind(this);
    this.rafId = requestAnimationFrame(this.loop);

    return () => {
      this.teardown();
    };
  }

  /**
   * Constructs the domain-warping fragment shader in Three Shading Language (TSL).
   */
  private buildTSLMaterial(): THREE.MeshBasicNodeMaterial {
    // 1. Deterministic 2D Value Noise Node with Quintic Hermite interpolation
    const valueNoise2D = tslFn(([p]: [any]) => {
      const i = floor(p);
      const f = fract(p);

      // Quintic Hermite curve: u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0)
      const u = f.mul(f).mul(f).mul(f.mul(f.mul(6.0).sub(15.0)).add(10.0));

      // 4-corner 2D pseudo-random hash generator
      const hash21 = (coord: any) => {
        const p2 = fract(coord.mul(vec2(0.1031, 0.1030)));
        const dotProd = dot(p2, p2.yx.add(33.33));
        return fract(p2.x.add(p2.y).mul(dotProd));
      };

      const a = hash21(i);
      const b = hash21(i.add(vec2(1.0, 0.0)));
      const c = hash21(i.add(vec2(0.0, 1.0)));
      const d = hash21(i.add(vec2(1.0, 1.0)));

      return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
    });

    // 2. Multi-Octave Fractional Brownian Motion (fBm) with rotated coordinate matrix
    const fbm2D = tslFn(([p]: [any]) => {
      let v = float(0.0);
      let a = float(0.5);
      let shift = p;

      // 5 Fixed Octaves with harmonic frequency doubling and rotation matrix [0.8, 0.6, -0.6, 0.8]
      // Octave 1
      v = v.add(a.mul(valueNoise2D(shift)));
      shift = vec2(shift.x.mul(0.8).add(shift.y.mul(0.6)), shift.x.mul(-0.6).add(shift.y.mul(0.8)))
        .mul(2.02)
        .add(vec2(100.0, 100.0));
      a = a.mul(0.5);

      // Octave 2
      v = v.add(a.mul(valueNoise2D(shift)));
      shift = vec2(shift.x.mul(0.8).add(shift.y.mul(0.6)), shift.x.mul(-0.6).add(shift.y.mul(0.8)))
        .mul(2.03)
        .add(vec2(100.0, 100.0));
      a = a.mul(0.5);

      // Octave 3
      v = v.add(a.mul(valueNoise2D(shift)));
      shift = vec2(shift.x.mul(0.8).add(shift.y.mul(0.6)), shift.x.mul(-0.6).add(shift.y.mul(0.8)))
        .mul(2.01)
        .add(vec2(100.0, 100.0));
      a = a.mul(0.5);

      // Octave 4
      v = v.add(a.mul(valueNoise2D(shift)));
      shift = vec2(shift.x.mul(0.8).add(shift.y.mul(0.6)), shift.x.mul(-0.6).add(shift.y.mul(0.8)))
        .mul(2.04)
        .add(vec2(100.0, 100.0));
      a = a.mul(0.5);

      // Octave 5
      v = v.add(a.mul(valueNoise2D(shift)));

      return v;
    });

    // 3. Recursive Inigo Quilez Domain Warping & Color Synthesis Node
    const domainWarpColor = tslFn(() => {
      // Aspect ratio corrected UV coordinates centered at (0, 0)
      const st = uv();
      const aspect = this.uResolution.x.div(this.uResolution.y);
      const coord = vec2(st.x.sub(0.5).mul(aspect), st.y.sub(0.5));

      // Rotate coordinates by distortion angle
      const cosA = cos(this.uDistortionAngle);
      const sinA = sin(this.uDistortionAngle);
      const rotCoord = vec2(
        coord.x.mul(cosA).sub(coord.y.mul(sinA)),
        coord.x.mul(sinA).add(coord.y.mul(cosA))
      );

      const p = rotCoord
        .mul(this.uFrequency)
        .add(this.uSeedOffset);

      const t = this.uTime.mul(this.uAnimSpeed).mul(0.2);

      // Interactive mouse swirl displacement
      const mPos = vec2(this.uMouse.x.sub(0.5).mul(aspect), this.uMouse.y.sub(0.5)).mul(this.uFrequency);
      const dMouse = p.sub(mPos);
      const distM = length(dMouse);
      const mWeight = clamp(float(1.0).sub(distM.mul(0.8)), 0.0, 1.0).mul(this.uMouseInfluence);
      const mouseOffset = vec2(dMouse.y.negate(), dMouse.x).mul(mWeight).mul(0.6);

      const pWarped = p.add(mouseOffset);

      // Layer 1: q = fbm(p)
      const q = vec2(
        fbm2D(pWarped.add(vec2(0.0, 0.0)).add(vec2(t.mul(0.25), t.mul(0.35)))),
        fbm2D(pWarped.add(vec2(5.2, 1.3)).add(vec2(t.mul(-0.3), t.mul(0.2))))
      );

      // Layer 2: r = fbm(p + 4.0*q)
      const r = vec2(
        fbm2D(pWarped.add(q.mul(4.0)).add(vec2(1.7, 9.2)).add(vec2(t.mul(0.15), t.mul(-0.25)))),
        fbm2D(pWarped.add(q.mul(4.0)).add(vec2(8.3, 2.8)).add(vec2(t.mul(-0.2), t.mul(0.18))))
      );

      // Layer 3: Final continuous scalar potential f = fbm(p + warpIntensity * r)
      const f = fbm2D(pWarped.add(r.mul(this.uWarpIntensity)));

      // Color Composite: Blend between the 4 palette layers
      // Layer 1: Void Obsidian -> Primary Tone using smooth S-curve
      const fAdjusted = clamp(f.mul(this.uColorSpread).sub(0.2).mul(1.8), 0.0, 1.0);
      const layer1 = mix(
        this.uColorA,
        this.uColorB,
        fAdjusted.mul(fAdjusted)
      );

      // Layer 2: Mix in Secondary Highlight for turbulent shear zones |q|
      const qMag = clamp(length(q).sub(0.55).mul(2.2), 0.0, 1.0);
      const layer2 = mix(
        layer1,
        this.uColorC,
        qMag
      );

      // Layer 3: Sharp starlight / crystal ridges from r.x and r.y
      const ridgeVal = clamp(r.x.mul(r.x).add(r.y.mul(r.y)).sub(0.45).mul(2.0), 0.0, 1.0);
      const layer3 = mix(
        layer2,
        this.uColorD,
        ridgeVal
      );

      // Contrast amplification & subtle corner vignette
      const vignette = clamp(float(1.1).sub(length(coord).mul(0.35)), 0.6, 1.0);
      const lighting = f.mul(1.2).sub(0.1);
      const finalColor = layer3.mul(clamp(lighting, 0.4, 1.3)).mul(vignette);

      return vec4(finalColor, 1.0);
    });

    const mat = new THREE.MeshBasicNodeMaterial();
    mat.colorNode = domainWarpColor();
    return mat;
  }

  /**
   * Called when simulation parameters change via Tweakpane or URL hash sync.
   */
  public updateParams(newParams: Record<string, any>): void {
    const prevSeed = this.targetParams.seed;
    this.applyParams(newParams, false);

    // If seed changed, randomize coordinate offset and reseed PRNG
    if (newParams.seed && newParams.seed !== prevSeed) {
      this.prng = createPRNG(newParams.seed);
      this.reseedCoordinates();
    }
  }

  /**
   * Updates canvas dimensions, aspect ratio, and Three.js viewport buffers.
   */
  public resize(width: number, height: number): void {
    this.width = Math.max(width, 100);
    this.height = Math.max(height, 100);

    if (this.renderer) {
      this.renderer.setSize(this.width, this.height, false);
      this.renderer.setPixelRatio(this.dpr);
    }

    this.uResolution.value.set(this.width, this.height);
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

    this.pointerX = event.normalizedX;
    this.pointerY = 1.0 - event.normalizedY; // Invert Y for shader UV coordinate space
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
   * Reseeds random coordinate domain offsets.
   */
  private reseedCoordinates(): void {
    const ox = this.prng.nextFloat(-500.0, 500.0);
    const oy = this.prng.nextFloat(-500.0, 500.0);
    this.uSeedOffset.value.set(ox, oy);
  }

  /**
   * Merges and validates parameter changes.
   */
  private applyParams(incoming: Record<string, any>, isInitial: boolean): void {
    this.targetParams = {
      seed: String(incoming.seed ?? this.targetParams.seed),
      warpIntensity: Math.min(Math.max(Number(incoming.warpIntensity ?? this.targetParams.warpIntensity), 0.0), 5.0),
      frequency: Math.min(Math.max(Number(incoming.frequency ?? this.targetParams.frequency), 0.2), 10.0),
      colorSpread: Math.min(Math.max(Number(incoming.colorSpread ?? this.targetParams.colorSpread), 0.2), 4.0),
      animSpeed: Math.min(Math.max(Number(incoming.animSpeed ?? this.targetParams.animSpeed), 0.0), 2.0),
      distortionAngle: Number(incoming.distortionAngle ?? this.targetParams.distortionAngle ?? 0.8),
      mouseInfluence: Number(incoming.mouseInfluence ?? this.targetParams.mouseInfluence ?? 1.2),
      colorPalette: incoming.colorPalette && DOMAIN_PALETTES[incoming.colorPalette]
        ? incoming.colorPalette
        : this.targetParams.colorPalette,
    };

    if (isInitial) {
      this.params = { ...this.targetParams };
      this.reseedCoordinates();
      this.updatePaletteUniforms(this.params.colorPalette);
    }
  }

  /**
   * Updates color uniform nodes to match selected curatorial palette.
   */
  private updatePaletteUniforms(paletteKey: string): void {
    const pal = DOMAIN_PALETTES[paletteKey] || DOMAIN_PALETTES['aurora-teal'];
    this.uColorA.value.setRGB(pal.colorA[0], pal.colorA[1], pal.colorA[2]);
    this.uColorB.value.setRGB(pal.colorB[0], pal.colorB[1], pal.colorB[2]);
    this.uColorC.value.setRGB(pal.colorC[0], pal.colorC[1], pal.colorC[2]);
    this.uColorD.value.setRGB(pal.colorD[0], pal.colorD[1], pal.colorD[2]);
  }

  /**
   * Main 60 FPS animation loop with differential exponential damping.
   */
  private loop(currentTime: number): void {
    if (!this.renderer || !this.scene || !this.camera) return;

    const dt = Math.min((currentTime - this.lastTime) / 1000, 0.05);
    this.lastTime = currentTime;

    // Smoothly lerp simulation parameters
    const lambda = 5.0;
    this.params.warpIntensity = dampParameter(this.params.warpIntensity, this.targetParams.warpIntensity, lambda, dt);
    this.params.frequency = dampParameter(this.params.frequency, this.targetParams.frequency, lambda, dt);
    this.params.colorSpread = dampParameter(this.params.colorSpread, this.targetParams.colorSpread, lambda, dt);
    this.params.animSpeed = dampParameter(this.params.animSpeed, this.targetParams.animSpeed, lambda, dt);
    this.params.distortionAngle = dampParameter(this.params.distortionAngle, this.targetParams.distortionAngle, lambda, dt);
    this.params.mouseInfluence = dampParameter(this.params.mouseInfluence, this.targetParams.mouseInfluence, lambda, dt);

    if (this.params.colorPalette !== this.targetParams.colorPalette) {
      this.params.colorPalette = this.targetParams.colorPalette;
      this.updatePaletteUniforms(this.params.colorPalette);
    }

    // Update uniform values
    this.uWarpIntensity.value = this.params.warpIntensity;
    this.uFrequency.value = this.params.frequency;
    this.uColorSpread.value = this.params.colorSpread;
    this.uAnimSpeed.value = this.params.animSpeed;
    this.uDistortionAngle.value = this.params.distortionAngle;
    this.uMouseInfluence.value = this.params.mouseInfluence * (this.isPointerDown ? 2.0 : 1.0);

    // Pointer smoothing
    if (this.pointerX > -500) {
      this.smoothedPointerX = dampParameter(this.smoothedPointerX, this.pointerX, 6.0, dt);
      this.smoothedPointerY = dampParameter(this.smoothedPointerY, this.pointerY, 6.0, dt);
      this.uMouse.value.set(this.smoothedPointerX, this.smoothedPointerY);
    } else {
      this.smoothedPointerX = dampParameter(this.smoothedPointerX, -10.0, 3.0, dt);
      this.smoothedPointerY = dampParameter(this.smoothedPointerY, -10.0, 3.0, dt);
      this.uMouse.value.set(-10.0, -10.0);
    }

    const motionScale = this.prefersReducedMotion ? 0.2 : 1.0;
    this.totalTime += dt * motionScale;
    this.uTime.value = this.totalTime;

    // Render WebGPU / WebGL2 frame
    this.renderer.render(this.scene, this.camera);

    this.rafId = requestAnimationFrame(this.loop);
  }

  /**
   * Custom High-Resolution Offline Snapshot Capture Pass.
   * Renders the domain warp shader onto an off-screen canvas at target resolution (e.g. 4K/8K).
   */
  public async captureSnapshot(width: number, height: number): Promise<HTMLCanvasElement> {
    const offCanvas = document.createElement('canvas');
    offCanvas.width = width;
    offCanvas.height = height;

    const offRenderer = new THREE.WebGPURenderer({
      canvas: offCanvas,
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    });

    await offRenderer.init();

    offRenderer.setSize(width, height, false);
    offRenderer.setPixelRatio(1);

    const offScene = new THREE.Scene();
    const offCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // Clone shader material with target resolution uniform
    const offMaterial = this.buildTSLMaterial();
    const offMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), offMaterial);
    offScene.add(offMesh);

    // Sync uniforms to current state
    this.uResolution.value.set(width, height);
    offRenderer.render(offScene, offCamera);

    // Restore viewport resolution
    this.uResolution.value.set(this.width, this.height);

    // Clean up temporary snapshot renderer
    offMaterial.dispose();
    offMesh.geometry.dispose();
    offRenderer.dispose();

    return offCanvas;
  }

  /**
   * Tears down Three.js scene, disposes shader materials, geometries, and WebGPU renderer context.
   */
  private teardown(): void {
    this.isMounted = false;

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh = null;
    }

    if (this.material) {
      this.material.dispose();
      this.material = null;
    }

    if (this.renderer) {
      try {
        this.renderer.dispose();
      } catch (err) {
        console.warn('Error disposing WebGPURenderer in DomainWarpRoom:', err);
      }
      this.renderer = null;
    }

    this.scene = null;
    this.camera = null;
    this.canvas = null;
  }
}

/**
 * Convenience factory creating a DomainWarpRoom instance.
 */
export function createRoom(): DomainWarpRoom {
  return new DomainWarpRoom();
}

export const room = new DomainWarpRoom();
export default room;
