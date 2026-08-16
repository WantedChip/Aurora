/**
 * Aurora GPU Capability & Hardware Tier Detection
 * 
 * Inspects WebGPU and WebGL2 capabilities at runtime, categorizes hardware into
 * execution tiers, and provides safe fallbacks for non-WebGPU environments.
 */

export type GPUTier = 'webgpu-full' | 'webgl2-fallback' | 'canvas2d-fallback';

export interface GPUAdapterDetails {
  vendor?: string;
  architecture?: string;
  device?: string;
  description?: string;
}

export interface GPUCapabilities {
  tier: GPUTier;
  hasWebGPU: boolean;
  hasWebGL2: boolean;
  adapterInfo: GPUAdapterDetails;
  maxTextureSize: number;
  maxComputeWorkgroupSize?: [number, number, number];
  maxBufferSize?: number;
  devicePixelRatio: number;
  isMobile: boolean;
  isTouch: boolean;
  unmaskedRenderer?: string;
  diagnosis?: string;
}

let cachedCapabilities: GPUCapabilities | null = null;
let detectionPromise: Promise<GPUCapabilities> | null = null;

/**
 * Detects whether the current device is mobile based on userAgent and pointer capabilities.
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  const userAgent = navigator.userAgent || navigator.vendor || '';
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
  const isTouch = navigator.maxTouchPoints > 0;
  return mobileRegex.test(userAgent) || (isTouch && window.innerWidth <= 1024);
}

/**
 * Returns the device pixel ratio clamped to a maximum threshold (default 2.0)
 * to prevent GPU fill-rate exhaustion on ultra-high-DPI screens.
 */
export function getClampedDPR(maxDPR = 2.0): number {
  if (typeof window === 'undefined') {
    return 1.0;
  }
  return Math.min(window.devicePixelRatio || 1.0, maxDPR);
}

/**
 * Inspects WebGL2 capabilities and hardware limits using an ephemeral canvas.
 */
function inspectWebGL2(): {
  hasWebGL2: boolean;
  maxTextureSize: number;
  unmaskedRenderer?: string;
} {
  if (typeof document === 'undefined') {
    return { hasWebGL2: false, maxTextureSize: 2048 };
  }

  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) {
      return { hasWebGL2: false, maxTextureSize: 2048 };
    }

    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096;
    let unmaskedRenderer: string | undefined;

    const dbgRenderInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (dbgRenderInfo) {
      unmaskedRenderer = gl.getParameter(dbgRenderInfo.UNMASKED_RENDERER_WEBGL) || undefined;
    }

    // Clean up WebGL context extension if possible
    const loseContext = gl.getExtension('WEBGL_lose_context');
    if (loseContext) {
      loseContext.loseContext();
    }

    return {
      hasWebGL2: true,
      maxTextureSize,
      unmaskedRenderer,
    };
  } catch {
    return { hasWebGL2: false, maxTextureSize: 2048 };
  }
}

/**
 * Performs full async inspection of WebGPU and WebGL2 capabilities.
 * Results are cached for instantaneous subsequent access.
 */
export async function detectGPUCapabilities(): Promise<GPUCapabilities> {
  if (cachedCapabilities) {
    return cachedCapabilities;
  }

  if (detectionPromise) {
    return detectionPromise;
  }

  detectionPromise = (async (): Promise<GPUCapabilities> => {
    const isMobile = isMobileDevice();
    const isTouch = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;
    const dpr = getClampedDPR(2.0);
    const webgl2Info = inspectWebGL2();

    let hasWebGPU = false;
    let adapterInfo: GPUAdapterDetails = {};
    let maxTextureSize = webgl2Info.maxTextureSize;
    let maxComputeWorkgroupSize: [number, number, number] | undefined;
    let maxBufferSize: number | undefined;

    // Check navigator.gpu availability
    const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;
    let webgpuError: string | undefined;

    if (nav && nav.gpu && typeof nav.gpu.requestAdapter === 'function') {
      try {
        let adapter = await nav.gpu.requestAdapter({ powerPreference: 'high-performance' });
        if (!adapter) {
          adapter = await nav.gpu.requestAdapter();
        }

        if (adapter) {
          hasWebGPU = true;
          try {
            const device = await adapter.requestDevice();
            if (device) {
              // Ensure device is functional
              device.destroy?.();
            }
          } catch (devErr) {
            console.warn('WebGPU device request warning:', devErr);
          }

          // Request adapter info if supported by browser
          try {
            if (typeof adapter.requestAdapterInfo === 'function') {
              const info = await adapter.requestAdapterInfo();
              adapterInfo = {
                vendor: info.vendor,
                architecture: info.architecture,
                device: info.device,
                description: info.description,
              };
            } else if (adapter.info) {
              const info = adapter.info;
              adapterInfo = {
                vendor: info.vendor,
                architecture: info.architecture,
                device: info.device,
                description: info.description,
              };
            }
          } catch {
            // Non-critical adapter info inspection failure
          }

          // Inspect limits
          if (adapter.limits) {
            maxTextureSize = adapter.limits.maxTextureDimension2D || maxTextureSize;
            maxComputeWorkgroupSize = [
              adapter.limits.maxComputeWorkgroupSizeX || 256,
              adapter.limits.maxComputeWorkgroupSizeY || 256,
              adapter.limits.maxComputeWorkgroupSizeZ || 64,
            ];
            maxBufferSize = adapter.limits.maxBufferSize;
          }
        }
      } catch (err) {
        console.warn('WebGPU adapter request failed:', err);
      }
    }

    let tier: GPUTier = 'canvas2d-fallback';
    let diagnosis = 'Hardware detection initialized.';

    if (hasWebGPU) {
      tier = 'webgpu-full';
      diagnosis = `WebGPU active (${adapterInfo.description || adapterInfo.vendor || 'Hardware Accelerated'}).`;
    } else if (webgl2Info.hasWebGL2) {
      tier = 'webgl2-fallback';
      if (typeof window !== 'undefined' && !window.isSecureContext) {
        diagnosis = 'WebGPU unavailable because page is not running in a Secure Context (HTTPS or localhost). Falling back to WebGL2.';
      } else if (webgpuError) {
        diagnosis = `WebGPU initialization note: ${webgpuError}. Falling back to WebGL2.`;
      } else {
        diagnosis = 'WebGPU adapter returned null in current browser environment. Falling back to WebGL2.';
      }
    } else {
      diagnosis = 'Neither WebGPU nor WebGL2 is supported in current browser environment. Canvas2D active.';
    }

    cachedCapabilities = {
      tier,
      hasWebGPU,
      hasWebGL2: webgl2Info.hasWebGL2,
      adapterInfo,
      maxTextureSize,
      maxComputeWorkgroupSize,
      maxBufferSize,
      devicePixelRatio: dpr,
      isMobile,
      isTouch,
      unmaskedRenderer: webgl2Info.unmaskedRenderer,
      diagnosis,
    };

    return cachedCapabilities;
  })();

  return detectionPromise;
}

/**
 * Returns current GPU tier directly.
 */
export async function getGPUTier(): Promise<GPUTier> {
  const caps = await detectGPUCapabilities();
  return caps.tier;
}

/**
 * Returns boolean indicating if WebGPU is available on the current device.
 */
export async function isWebGPUSupported(): Promise<boolean> {
  const caps = await detectGPUCapabilities();
  return caps.hasWebGPU;
}

/**
 * Returns maximum supported texture dimension (e.g. 4096, 8192, 16384).
 */
export async function getMaxTextureSize(): Promise<number> {
  const caps = await detectGPUCapabilities();
  return caps.maxTextureSize;
}

/**
 * Formats a short museum-style hardware badge string for telemetry readouts.
 * (e.g., "WEBGPU READY • 8K MAX" or "WEBGL2 FALLBACK")
 */
export function formatGPUTelemetryBadge(caps: GPUCapabilities): string {
  if (caps.tier === 'webgpu-full') {
    return `WEBGPU READY • ${caps.maxTextureSize}PX MAX`;
  }
  if (caps.tier === 'webgl2-fallback') {
    return `WEBGL2 TSL • ${caps.maxTextureSize}PX MAX`;
  }
  return 'CANVAS 2D FALLBACK';
}
