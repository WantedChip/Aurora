/**
 * Aurora Room, Metadata & Control Definition Type Contracts
 */

import type { PRNG } from '../lib/prng';
import type { AudioManager } from '../lib/audio';

export type RoomCategory =
  | 'field-flow'
  | 'art-life'
  | 'chaos'
  | 'fluid'
  | 'cosmic'
  | 'audio';

export type ComputeBackend =
  | 'webgpu-compute'
  | 'tsl-shader'
  | 'webgl2'
  | 'canvas2d';

export type ControlType = 'slider' | 'select' | 'boolean' | 'color' | 'button';

export interface SelectOption<T = any> {
  label: string;
  value: T;
}

export interface ControlDef {
  key: string;
  label: string;
  type: ControlType;
  min?: number;
  max?: number;
  step?: number;
  options?: SelectOption[];
  folder?: string;
  description?: string;
  action?: () => void;
}

export interface RoomMetadata {
  id: string;
  index: number;
  indexDisplay: string; // e.g. "#01"
  name: string;
  category: RoomCategory;
  categoryName: string;
  backend: ComputeBackend;
  backendDisplay: string;
  mathModel: string;
  description: string;
  curatorialNote?: string;
  tags: string[];
  moods: string[];
  defaultParams: Record<string, any>;
  controls: ControlDef[];
}

export interface RoomPointerEvent {
  type: 'down' | 'move' | 'up' | 'leave';
  x: number;
  y: number;
  normalizedX: number; // 0.0 to 1.0 (left to right)
  normalizedY: number; // 0.0 to 1.0 (top to bottom)
  isDown: boolean;
}

export interface RoomContext {
  canvas: HTMLCanvasElement;
  container: HTMLElement;
  params: Record<string, any>;
  prng: PRNG;
  dpr: number;
  audio?: AudioManager;
  onParamChange?: (key: string, value: any) => void;
}

export type RoomCleanupFn = () => void;

export interface RoomInstance {
  /**
   * Mounts the room simulation to the provided canvas and container.
   * Must return an explicit cleanup function to dispose GPU buffers, listeners, and RAF timers.
   */
  mount(ctx: RoomContext): Promise<RoomCleanupFn> | RoomCleanupFn;

  /**
   * Called when simulation parameters change via Tweakpane or URL state sync.
   */
  updateParams?(params: Record<string, any>): void;

  /**
   * Called when viewport dimensions change.
   */
  resize?(width: number, height: number): void;

  /**
   * Called when pointer moves or clicks over the interactive viewport.
   */
  onPointer?(event: RoomPointerEvent): void;

  /**
   * Optional custom offscreen high-resolution capture hook for snapshot export.
   */
  captureSnapshot?(width: number, height: number): Promise<HTMLCanvasElement | Blob>;
}

export interface RoomModule {
  default?: RoomInstance;
  room?: RoomInstance;
}
