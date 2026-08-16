/**
 * Aurora Deterministic Pseudorandom Number Generator (PRNG)
 * 
 * Implements 32-bit Mulberry32 algorithm.
 * Guarantees bit-identical procedural generation across all browsers and platforms
 * for any given seed value.
 */

/**
 * 32-bit string hashing using MurmurHash3 variant (x86 32-bit).
 * Converts arbitrary text/seed strings into a deterministic 32-bit unsigned integer.
 */
export function hashString(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
    h >>>= 0;
  }
  return h >>> 0;
}

/**
 * Normalizes any seed input (number, hex string, or arbitrary text) into a 32-bit unsigned integer.
 */
export function parseSeed(seedInput: number | string): number {
  if (typeof seedInput === 'number') {
    return (seedInput >>> 0) || 1;
  }

  const trimmed = seedInput.trim();
  if (!trimmed) {
    return 1;
  }

  // Handle hex representations (e.g., "#A8F29" or "0xA8F29" or "A8F29")
  const hexMatch = trimmed.match(/^#?([0-9a-fA-F]+)$/);
  if (hexMatch && hexMatch[1].length <= 8) {
    const parsed = parseInt(hexMatch[1], 16);
    if (!Number.isNaN(parsed)) {
      return (parsed >>> 0) || 1;
    }
  }

  // Fallback to string hashing
  return hashString(trimmed) || 1;
}

/**
 * Generates a clean, museum-style 6-character uppercase hex seed string (e.g., "#A8F29D").
 */
export function generateRandomSeed(): string {
  const randomUint = (Math.random() * 0xffffff) >>> 0;
  return '#' + randomUint.toString(16).toUpperCase().padStart(6, '0');
}

/**
 * Core Mulberry32 generator function.
 * Given a 32-bit integer seed, returns a function that produces floats in [0, 1).
 */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function (): number {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Object-oriented PRNG wrapper with rich convenience methods.
 */
export class PRNG {
  private initialSeed: number;
  private currentSeed: number;
  private nextRaw: () => number;

  constructor(seed: number | string = 1) {
    this.initialSeed = parseSeed(seed);
    this.currentSeed = this.initialSeed;
    this.nextRaw = mulberry32(this.currentSeed);
  }

  /**
   * Resets generator to original seed or a new seed.
   */
  public reset(newSeed?: number | string): void {
    if (newSeed !== undefined) {
      this.initialSeed = parseSeed(newSeed);
    }
    this.currentSeed = this.initialSeed;
    this.nextRaw = mulberry32(this.currentSeed);
  }

  /**
   * Returns a pseudorandom floating point number in range [0, 1).
   */
  public next(): number {
    return this.nextRaw();
  }

  /**
   * Returns a pseudorandom floating point number in range [min, max).
   */
  public nextFloat(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /**
   * Returns a pseudorandom integer in range [min, max] inclusive.
   */
  public nextInt(min: number, max: number): number {
    const minCeil = Math.ceil(min);
    const maxFloor = Math.floor(max);
    return Math.floor(this.next() * (maxFloor - minCeil + 1)) + minCeil;
  }

  /**
   * Returns true with the given probability (default 0.5).
   */
  public nextBool(probability = 0.5): boolean {
    return this.next() < probability;
  }

  /**
   * Selects a random element from a non-empty array.
   */
  public choice<T>(array: readonly T[]): T {
    if (array.length === 0) {
      throw new Error('PRNG.choice called with empty array');
    }
    return array[this.nextInt(0, array.length - 1)];
  }

  /**
   * Randomly shuffles an array in place using Fisher-Yates algorithm.
   */
  public shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      const temp = array[i];
      array[i] = array[j];
      array[j] = temp;
    }
    return array;
  }

  /**
   * Returns a normally distributed pseudorandom float (mean = 0, stdev = 1)
   * using Box-Muller transform.
   */
  public nextGaussian(mean = 0, stdev = 1): number {
    let u = 0;
    let v = 0;
    while (u === 0) u = this.next();
    while (v === 0) v = this.next();
    const num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return num * stdev + mean;
  }

  /**
   * Creates an independent child PRNG derived deterministically from the current state.
   */
  public fork(): PRNG {
    return new PRNG(this.nextInt(0, 0xffffffff));
  }

  /**
   * Returns the initial numerical 32-bit seed.
   */
  public getSeed(): number {
    return this.initialSeed;
  }

  /**
   * Returns the initial seed formatted as a standard uppercase hex string.
   */
  public getSeedHex(): string {
    return '#' + (this.initialSeed >>> 0).toString(16).toUpperCase().padStart(6, '0');
  }
}

/**
 * Convenience factory function.
 */
export function createPRNG(seed: number | string = 1): PRNG {
  return new PRNG(seed);
}
