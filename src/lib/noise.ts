/**
 * Aurora Deterministic Procedural Noise Engine
 * 
 * Implements 2D & 3D Simplex noise, multi-octave Fractional Brownian Motion (fBm),
 * and 2D Curl Noise vector fields seeded deterministically via PRNG.
 */

import { createPRNG, type PRNG } from './prng';

// 2D Simplex Skew & Unskew Constants
const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;

// 3D Simplex Skew & Unskew Constants
const F3 = 1.0 / 3.0;
const G3 = 1.0 / 6.0;

// 2D Gradient table
const GRAD2: readonly [number, number][] = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [0, 1], [0, -1],
];

// 3D Gradient table
const GRAD3: readonly [number, number, number][] = [
  [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
  [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
  [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
];

export class SimplexNoise {
  private perm = new Uint8Array(512);
  private permMod12 = new Uint8Array(512);
  private permMod8 = new Uint8Array(512);

  constructor(seed: number | string | PRNG = 1) {
    this.reseed(seed);
  }

  /**
   * Reseeds the permutation tables using a deterministic PRNG.
   */
  public reseed(seed: number | string | PRNG): void {
    const prng = seed instanceof Object && 'next' in seed ? seed : createPRNG(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      p[i] = i;
    }

    // Shuffle permutation table deterministically
    for (let i = 255; i > 0; i--) {
      const j = prng.nextInt(0, i);
      const temp = p[i];
      p[i] = p[j];
      p[j] = temp;
    }

    for (let i = 0; i < 512; i++) {
      const val = p[i & 255];
      this.perm[i] = val;
      this.permMod12[i] = val % 12;
      this.permMod8[i] = val % 8;
    }
  }

  /**
   * 2D Simplex Noise in range [-1, 1].
   */
  public noise2D(xin: number, yin: number): number {
    let n0 = 0;
    let n1 = 0;
    let n2 = 0;

    // Skew the input space to determine which simplex cell we're in
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = xin - X0;
    const y0 = yin - Y0;

    // Determine which simplex triangle we are in
    let i1: number;
    let j1: number;
    if (x0 > y0) {
      i1 = 1;
      j1 = 0;
    } else {
      i1 = 0;
      j1 = 1;
    }

    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1.0 + 2.0 * G2;
    const y2 = y0 - 1.0 + 2.0 * G2;

    // Work out the hashed gradient indices of the three simplex corners
    const ii = i & 255;
    const jj = j & 255;

    // Calculate contribution from corner 0
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 > 0) {
      const gi0 = this.permMod8[ii + this.perm[jj]];
      const [gx, gy] = GRAD2[gi0];
      t0 *= t0;
      n0 = t0 * t0 * (gx * x0 + gy * y0);
    }

    // Calculate contribution from corner 1
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 > 0) {
      const gi1 = this.permMod8[ii + i1 + this.perm[jj + j1]];
      const [gx, gy] = GRAD2[gi1];
      t1 *= t1;
      n1 = t1 * t1 * (gx * x1 + gy * y1);
    }

    // Calculate contribution from corner 2
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 > 0) {
      const gi2 = this.permMod8[ii + 1 + this.perm[jj + 1]];
      const [gx, gy] = GRAD2[gi2];
      t2 *= t2;
      n2 = t2 * t2 * (gx * x2 + gy * y2);
    }

    // Scale to return [-1, 1]
    return 70.0 * (n0 + n1 + n2);
  }

  /**
   * 3D Simplex Noise in range [-1, 1].
   */
  public noise3D(xin: number, yin: number, zin: number): number {
    let n0 = 0;
    let n1 = 0;
    let n2 = 0;
    let n3 = 0;

    // Skew the input space to determine which simplex cell we're in
    const s = (xin + yin + zin) * F3;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const k = Math.floor(zin + s);
    const t = (i + j + k) * G3;
    const X0 = i - t;
    const Y0 = j - t;
    const Z0 = k - t;
    const x0 = xin - X0;
    const y0 = yin - Y0;
    const z0 = zin - Z0;

    // Determine which simplex traversal order
    let i1: number, j1: number, k1: number;
    let i2: number, j2: number, k2: number;

    if (x0 >= y0) {
      if (y0 >= z0) {
        i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0;
      } else if (x0 >= z0) {
        i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1;
      } else {
        i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1;
      }
    } else {
      if (y0 < z0) {
        i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1;
      } else if (x0 < z0) {
        i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1;
      } else {
        i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0;
      }
    }

    const x1 = x0 - i1 + G3;
    const y1 = y0 - j1 + G3;
    const z1 = z0 - k1 + G3;
    const x2 = x0 - i2 + 2.0 * G3;
    const y2 = y0 - j2 + 2.0 * G3;
    const z2 = z0 - k2 + 2.0 * G3;
    const x3 = x0 - 1.0 + 3.0 * G3;
    const y3 = y0 - 1.0 + 3.0 * G3;
    const z3 = z0 - 1.0 + 3.0 * G3;

    const ii = i & 255;
    const jj = j & 255;
    const kk = k & 255;

    // Calculate contribution from corner 0
    let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
    if (t0 > 0) {
      const gi0 = this.permMod12[ii + this.perm[jj + this.perm[kk]]];
      const [gx, gy, gz] = GRAD3[gi0];
      t0 *= t0;
      n0 = t0 * t0 * (gx * x0 + gy * y0 + gz * z0);
    }

    // Calculate contribution from corner 1
    let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
    if (t1 > 0) {
      const gi1 = this.permMod12[ii + i1 + this.perm[jj + j1 + this.perm[kk + k1]]];
      const [gx, gy, gz] = GRAD3[gi1];
      t1 *= t1;
      n1 = t1 * t1 * (gx * x1 + gy * y1 + gz * z1);
    }

    // Calculate contribution from corner 2
    let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
    if (t2 > 0) {
      const gi2 = this.permMod12[ii + i2 + this.perm[jj + j2 + this.perm[kk + k2]]];
      const [gx, gy, gz] = GRAD3[gi2];
      t2 *= t2;
      n2 = t2 * t2 * (gx * x2 + gy * y2 + gz * z2);
    }

    // Calculate contribution from corner 3
    let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
    if (t3 > 0) {
      const gi3 = this.permMod12[ii + 1 + this.perm[jj + 1 + this.perm[kk + 1]]];
      const [gx, gy, gz] = GRAD3[gi3];
      t3 *= t3;
      n3 = t3 * t3 * (gx * x3 + gy * y3 + gz * z3);
    }

    // Scale to return [-1, 1]
    return 32.0 * (n0 + n1 + n2 + n3);
  }

  /**
   * Fractional Brownian Motion (fBm) multi-octave 2D noise.
   */
  public fbm2D(x: number, y: number, octaves = 4, lacunarity = 2.0, gain = 0.5): number {
    let sum = 0;
    let amp = 1.0;
    let freq = 1.0;
    let maxAmp = 0;

    for (let i = 0; i < octaves; i++) {
      sum += this.noise2D(x * freq, y * freq) * amp;
      maxAmp += amp;
      freq *= lacunarity;
      amp *= gain;
    }

    return sum / maxAmp;
  }

  /**
   * Fractional Brownian Motion (fBm) multi-octave 3D noise (x, y, time).
   */
  public fbm3D(x: number, y: number, z: number, octaves = 3, lacunarity = 2.0, gain = 0.5): number {
    let sum = 0;
    let amp = 1.0;
    let freq = 1.0;
    let maxAmp = 0;

    for (let i = 0; i < octaves; i++) {
      sum += this.noise3D(x * freq, y * freq, z * freq) * amp;
      maxAmp += amp;
      freq *= lacunarity;
      amp *= gain;
    }

    return sum / maxAmp;
  }

  /**
   * Computes 2D Curl Noise vector at coordinate (x, y, z) using finite differences of fBm potential.
   * Curl noise is mathematically divergence-free (∇ · v = 0), preventing unnatural particle collapse.
   */
  public curl2D(
    x: number,
    y: number,
    z: number,
    octaves = 3,
    eps = 0.005
  ): { vx: number; vy: number } {
    // Sample potential field with slight spatial offsets
    const n1 = this.fbm3D(x, y + eps, z, octaves);
    const n2 = this.fbm3D(x, y - eps, z, octaves);
    const n3 = this.fbm3D(x + eps, y, z, octaves);
    const n4 = this.fbm3D(x - eps, y, z, octaves);

    // v_x = ∂ψ/∂y, v_y = -∂ψ/∂x
    const vx = (n1 - n2) / (2 * eps);
    const vy = -(n3 - n4) / (2 * eps);

    return { vx, vy };
  }
}

/**
 * Creates a new SimplexNoise instance seeded deterministically.
 */
export function createSimplexNoise(seed: number | string | PRNG = 1): SimplexNoise {
  return new SimplexNoise(seed);
}
