/**
 * Aurora Canvas Snapshot & Video Recording Pipeline
 * 
 * Provides:
 * 1. High-resolution lossless PNG/JPEG canvas snapshot export (1x, 2x, 4x Archival).
 * 2. Seamless 60 FPS / 30 FPS video loop recording using MediaRecorder and canvas.captureStream().
 * 3. Automatic cross-platform video codec negotiation (WebM VP9/VP8 vs MP4 AVC1).
 */

import { getMaxTextureSize } from './gpu';

export interface SnapshotOptions {
  resolutionScale?: 1 | 2 | 4;
  format?: 'image/png' | 'image/jpeg' | 'image/webp';
  quality?: number; // 0.0 - 1.0 (for JPEG/WebP)
  filenamePrefix?: string;
  seed?: string;
  autoDownload?: boolean;
  onProgress?: (progress: number) => void;
  customRenderPass?: (width: number, height: number) => Promise<HTMLCanvasElement | Blob>;
}

export interface VideoRecordOptions {
  durationSeconds?: number; // Default 5s
  fps?: number; // Default 60
  bitrate?: number; // Default 12,000,000 (12 Mbps)
  filenamePrefix?: string;
  seed?: string;
  autoDownload?: boolean;
  onProgress?: (progressRatio: number, elapsedMs: number) => void;
  onStart?: () => void;
  onComplete?: (blob: Blob) => void;
  onError?: (error: Error) => void;
}

export interface NegotiatedCodec {
  mimeType: string;
  extension: string;
}

let activeRecorder: MediaRecorder | null = null;
let activeRecordingStream: MediaStream | null = null;
let activeRecordingTimer: number | null = null;
let activeProgressInterval: number | null = null;

/**
 * Negotiates the highest-quality video codec supported by the current browser.
 */
export function negotiateSupportedVideoCodec(): NegotiatedCodec {
  if (typeof window === 'undefined' || typeof (window as any).MediaRecorder === 'undefined') {
    return { mimeType: 'video/webm', extension: 'webm' };
  }

  const MediaRecorderClass = (window as any).MediaRecorder;
  const candidateCodecs: { mimeType: string; extension: string }[] = [
    { mimeType: 'video/webm;codecs=vp9,opus', extension: 'webm' },
    { mimeType: 'video/webm;codecs=vp9', extension: 'webm' },
    { mimeType: 'video/webm;codecs=vp8,opus', extension: 'webm' },
    { mimeType: 'video/webm;codecs=vp8', extension: 'webm' },
    { mimeType: 'video/webm', extension: 'webm' },
    { mimeType: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', extension: 'mp4' },
    { mimeType: 'video/mp4;codecs=avc1', extension: 'mp4' },
    { mimeType: 'video/mp4', extension: 'mp4' },
  ];

  for (const candidate of candidateCodecs) {
    if (MediaRecorderClass.isTypeSupported && MediaRecorderClass.isTypeSupported(candidate.mimeType)) {
      return candidate;
    }
  }

  return { mimeType: 'video/webm', extension: 'webm' };
}

/**
 * Triggers a programmatic browser download of a Blob.
 */
export function triggerBlobDownload(blob: Blob, filename: string): void {
  if (typeof document === 'undefined') return;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();

  setTimeout(() => {
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, 200);
}

/**
 * Formats a clean archival filename (e.g. "aurora-physarum-A8F29-20260817-030000.png").
 */
export function formatExportFilename(
  prefix = 'aurora-exhibit',
  seed?: string,
  extension = 'png'
): string {
  const cleanSeed = seed ? seed.replace(/^#/, '') : 'SEED';
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
  return `${prefix}-${cleanSeed}-${dateStr}-${timeStr}.${extension}`;
}

/**
 * Captures a high-resolution lossless snapshot of an active canvas.
 */
export async function captureSnapshot(
  canvas: HTMLCanvasElement,
  options: SnapshotOptions = {}
): Promise<Blob> {
  const {
    resolutionScale = 1,
    format = 'image/png',
    quality = 0.95,
    filenamePrefix = 'aurora-snapshot',
    seed,
    autoDownload = true,
    customRenderPass,
    onProgress,
  } = options;

  onProgress?.(0.1);

  // If a custom high-res render pass is provided by the room instance
  if (customRenderPass) {
    const targetW = canvas.width * resolutionScale;
    const targetH = canvas.height * resolutionScale;
    const result = await customRenderPass(targetW, targetH);
    onProgress?.(0.8);

    let blob: Blob;
    if (result instanceof Blob) {
      blob = result;
    } else {
      blob = await new Promise<Blob>((resolve, reject) => {
        result.toBlob(
          b => (b ? resolve(b) : reject(new Error('Failed to create snapshot blob'))),
          format,
          quality
        );
      });
    }

    onProgress?.(1.0);
    if (autoDownload) {
      const ext = format === 'image/jpeg' ? 'jpg' : format === 'image/webp' ? 'webp' : 'png';
      const filename = formatExportFilename(filenamePrefix, seed, ext);
      triggerBlobDownload(blob, filename);
    }
    return blob;
  }

  // Standard canvas offscreen scaling capture
  const maxTextureLimit = await getMaxTextureSize();
  const rawW = canvas.width;
  const rawH = canvas.height;

  let scale: number = resolutionScale;
  if (rawW * scale > maxTextureLimit || rawH * scale > maxTextureLimit) {
    scale = Math.min(maxTextureLimit / rawW, maxTextureLimit / rawH);
    console.warn(`Snapshot resolution scaled down to ${scale.toFixed(2)}x to fit GPU texture limit (${maxTextureLimit}px).`);
  }

  const targetWidth = Math.round(rawW * scale);
  const targetHeight = Math.round(rawH * scale);

  onProgress?.(0.3);

  let exportCanvas: HTMLCanvasElement;

  if (scale === 1) {
    exportCanvas = canvas;
  } else {
    exportCanvas = document.createElement('canvas');
    exportCanvas.width = targetWidth;
    exportCanvas.height = targetHeight;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to create offscreen 2D canvas context for snapshot scaling.');
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(canvas, 0, 0, targetWidth, targetHeight);
  }

  onProgress?.(0.7);

  const blob = await new Promise<Blob>((resolve, reject) => {
    exportCanvas.toBlob(
      b => {
        if (b) {
          resolve(b);
        } else {
          reject(new Error('canvas.toBlob returned null during snapshot capture.'));
        }
      },
      format,
      quality
    );
  });

  onProgress?.(1.0);

  if (autoDownload) {
    const ext = format === 'image/jpeg' ? 'jpg' : format === 'image/webp' ? 'webp' : 'png';
    const filename = formatExportFilename(filenamePrefix, seed, ext);
    triggerBlobDownload(blob, filename);
  }

  return blob;
}

/**
 * Returns true if a video recording is currently in progress.
 */
export function isRecordingActive(): boolean {
  return activeRecorder !== null && activeRecorder.state === 'recording';
}

/**
 * Cancels and discards any active video recording session.
 */
export function cancelVideoRecording(): void {
  if (activeProgressInterval) {
    clearInterval(activeProgressInterval);
    activeProgressInterval = null;
  }

  if (activeRecordingTimer) {
    clearTimeout(activeRecordingTimer);
    activeRecordingTimer = null;
  }

  if (activeRecorder && activeRecorder.state !== 'inactive') {
    try {
      activeRecorder.stop();
    } catch {}
  }
  activeRecorder = null;

  if (activeRecordingStream) {
    activeRecordingStream.getTracks().forEach(track => track.stop());
    activeRecordingStream = null;
  }
}

/**
 * Records a video loop of the active canvas stream using MediaRecorder.
 */
export function recordVideoLoop(
  canvas: HTMLCanvasElement,
  options: VideoRecordOptions = {}
): Promise<Blob> {
  const {
    durationSeconds = 5,
    fps = 60,
    bitrate = 12000000,
    filenamePrefix = 'aurora-loop',
    seed,
    autoDownload = true,
    onProgress,
    onStart,
    onComplete,
    onError,
  } = options;

  if (isRecordingActive()) {
    cancelVideoRecording();
  }

  return new Promise<Blob>((resolve, reject) => {
    if (typeof (canvas as any).captureStream !== 'function') {
      const err = new Error('HTMLCanvasElement.captureStream() is not supported in this browser.');
      onError?.(err);
      reject(err);
      return;
    }

    const { mimeType, extension } = negotiateSupportedVideoCodec();
    const stream: MediaStream = (canvas as any).captureStream(fps);
    activeRecordingStream = stream;

    const recordedChunks: Blob[] = [];
    let recorder: MediaRecorder;

    try {
      recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: bitrate,
      });
      activeRecorder = recorder;
    } catch (err: any) {
      console.warn(`MediaRecorder init failed for mimeType "${mimeType}". Falling back to default options.`, err);
      try {
        recorder = new MediaRecorder(stream);
        activeRecorder = recorder;
      } catch (fallbackErr: any) {
        onError?.(fallbackErr);
        reject(fallbackErr);
        return;
      }
    }

    recorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    recorder.onerror = (event: any) => {
      const err = event.error || new Error('MediaRecorder encountered an unexpected recording error.');
      cancelVideoRecording();
      onError?.(err);
      reject(err);
    };

    recorder.onstop = () => {
      if (activeProgressInterval) {
        clearInterval(activeProgressInterval);
        activeProgressInterval = null;
      }

      if (activeRecordingStream) {
        activeRecordingStream.getTracks().forEach(track => track.stop());
        activeRecordingStream = null;
      }

      activeRecorder = null;

      const videoBlob = new Blob(recordedChunks, { type: mimeType });
      onProgress?.(1.0, durationSeconds * 1000);
      onComplete?.(videoBlob);

      if (autoDownload) {
        const filename = formatExportFilename(filenamePrefix, seed, extension);
        triggerBlobDownload(videoBlob, filename);
      }

      resolve(videoBlob);
    };

    // Start recording
    const startTime = performance.now();
    recorder.start(250); // Emit data chunk every 250ms
    onStart?.();
    onProgress?.(0.0, 0);

    // Progress tick interval
    activeProgressInterval = window.setInterval(() => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1.0, elapsed / (durationSeconds * 1000));
      onProgress?.(progress, elapsed);
    }, 100);

    // Auto-stop timer
    activeRecordingTimer = window.setTimeout(() => {
      if (recorder.state === 'recording') {
        recorder.stop();
      }
    }, durationSeconds * 1000);
  });
}
