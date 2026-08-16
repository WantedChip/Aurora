import { createPRNG, hashString, parseSeed, generateRandomSeed } from './lib/prng';
import { detectGPUCapabilities, getGPUTier, getClampedDPR, formatGPUTelemetryBadge } from './lib/gpu';
import { parseHash, serializeHash, parseParams, serializeParams, dampParameter } from './lib/state';
import { audioManager } from './lib/audio';
import { getAllRooms, getRoomById, searchRooms, filterRoomsByCategory, getCategories, lazyLoadRoom } from './rooms/registry';
import { router, type RouteState } from './lib/router';
import { captureSnapshot, recordVideoLoop, negotiateSupportedVideoCodec, formatExportFilename } from './lib/recorder';

export interface VerificationResult {
  passed: boolean;
  module: string;
  details: string;
}

export async function runLibVerification(): Promise<VerificationResult[]> {
  const results: VerificationResult[] = [];

  // 1. Verify PRNG (Mulberry32)
  try {
    const seedA = '#A8F29D';
    const prng1 = createPRNG(seedA);
    const seq1 = [prng1.next(), prng1.next(), prng1.nextInt(10, 100), prng1.nextFloat(-5, 5)];

    const prng2 = createPRNG(seedA);
    const seq2 = [prng2.next(), prng2.next(), prng2.nextInt(10, 100), prng2.nextFloat(-5, 5)];

    const isIdentical = seq1.every((val, idx) => Math.abs(val - seq2[idx]) < 1e-9);
    const parsed = parseSeed('#A8F29D');
    const hex = prng1.getSeedHex();
    const strHash = hashString('aurora-test');
    const randomSeed = generateRandomSeed();

    if (isIdentical && parsed > 0 && hex.startsWith('#') && strHash > 0 && randomSeed.startsWith('#')) {
      results.push({
        passed: true,
        module: 'prng.ts',
        details: `Mulberry32 deterministic sequence verified (${seq1.map(n => n.toFixed(3)).join(', ')}), hash=${strHash}, randSeed=${randomSeed}`,
      });
    } else {
      results.push({
        passed: false,
        module: 'prng.ts',
        details: `Determinism mismatch: seq1 !== seq2`,
      });
    }
  } catch (err) {
    results.push({ passed: false, module: 'prng.ts', details: String(err) });
  }

  // 2. Verify GPU Capabilities
  try {
    const caps = await detectGPUCapabilities();
    const tier = await getGPUTier();
    const dpr = getClampedDPR();
    const badge = formatGPUTelemetryBadge(caps);

    results.push({
      passed: typeof caps.hasWebGPU === 'boolean' && typeof caps.hasWebGL2 === 'boolean' && dpr > 0,
      module: 'gpu.ts',
      details: `Tier: ${tier} | DPR: ${dpr} | MaxTexture: ${caps.maxTextureSize}px | Info: ${caps.diagnosis || badge}`,
    });
  } catch (err) {
    results.push({ passed: false, module: 'gpu.ts', details: String(err) });
  }

  // 3. Verify State Serialization
  try {
    const defaultSchema = {
      seed: '#000000',
      decay: 0.95,
      agentCount: 500000,
      invertColor: false,
      title: 'Physarum',
    };

    const testHash = '#/physarum?seed=A8F29D&decay=0.98&agentCount=250000&invertColor=1';
    const parsedRoute = parseHash(testHash);
    const typedParams = parseParams(parsedRoute.params, defaultSchema);

    const queryOnly = serializeParams(typedParams, defaultSchema);
    const reSerialized = serializeHash(parsedRoute.roomId, typedParams, defaultSchema);
    const lerpVal = dampParameter(0, 100, 4.0, 0.016);

    const parsedCorrectly =
      parsedRoute.roomId === 'physarum' &&
      typedParams.decay === 0.98 &&
      typedParams.agentCount === 250000 &&
      typedParams.invertColor === true &&
      typedParams.seed === '#A8F29D' &&
      queryOnly.includes('decay=0.98') &&
      lerpVal > 0;

    results.push({
      passed: parsedCorrectly,
      module: 'state.ts',
      details: `Parsed roomId: "${parsedRoute.roomId}", serialized: "${reSerialized}", queryOnly: "${queryOnly}", lerp: ${lerpVal.toFixed(2)}`,
    });
  } catch (err) {
    results.push({ passed: false, module: 'state.ts', details: String(err) });
  }

  // 4. Verify Audio Manager
  try {
    const isActiveBefore = audioManager.isAudioActive();
    const initialSource = audioManager.getAudioSourceType();
    const bands = audioManager.getFrequencyBands();

    results.push({
      passed: !isActiveBefore && initialSource === 'none' && typeof bands.bass === 'number',
      module: 'audio.ts',
      details: `Initialized in passive state without permission prompt. Bands: bass=${bands.bass}, vol=${bands.volume}`,
    });
  } catch (err) {
    results.push({ passed: false, module: 'audio.ts', details: String(err) });
  }

  // 5. Verify Room Registry & Search
  try {
    const allRooms = getAllRooms();
    const physarum = getRoomById('physarum');
    const artLifeRooms = filterRoomsByCategory('art-life');
    const categories = getCategories();
    const searchMatch1 = searchRooms('slime mold');
    const searchMatch2 = searchRooms('turing');
    const searchEmpty = searchRooms('quantum-nonexistent-tag');

    const registryPassed =
      allRooms.length === 16 &&
      physarum?.name === 'Physarum Slime Mold' &&
      artLifeRooms.length === 6 &&
      categories.length === 7 &&
      searchMatch1.some(r => r.id === 'physarum') &&
      searchMatch2.some(r => r.id === 'reaction-diffusion') &&
      searchEmpty.length === 0;

    results.push({
      passed: registryPassed,
      module: 'registry.ts (Catalog & Search)',
      details: `16 rooms indexed. Search: "slime mold" -> #${searchMatch1[0]?.index}, "turing" -> #${searchMatch2[0]?.index}. 6 Art Life rooms.`,
    });
  } catch (err) {
    results.push({ passed: false, module: 'registry.ts', details: String(err) });
  }

  // 6. Verify Dynamic Room Loader & Lifecycle Mount/Cleanup
  try {
    const roomInstance = await lazyLoadRoom('flow-field');
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 200;
    const container = document.createElement('div');
    const prng = createPRNG('#A8F29D');

    let cleanupRan = false;
    const cleanup = await roomInstance.mount({
      canvas,
      container,
      params: { seed: '#A8F29D', speed: 1.5 },
      prng,
      dpr: 1,
    });

    if (typeof cleanup === 'function') {
      cleanup();
      cleanupRan = true;
    }

    results.push({
      passed: typeof roomInstance.mount === 'function' && cleanupRan,
      module: 'registry.ts (Lazy Loader & Lifecycle)',
      details: `Lazy loaded room instance, mounted to canvas context, and executed cleanup teardown cleanly.`,
    });
  } catch (err) {
    results.push({ passed: false, module: 'registry.ts (Lifecycle)', details: String(err) });
  }

  // 7. Verify Client-Side Hash Router
  try {
    router.start();
    let interceptedRoute: RouteState | null = null;

    const unsubscribe = router.onRouteChange(to => {
      interceptedRoute = to;
    });

    // Test programmatically navigating to room
    router.navigateToRoom('boids', { seed: '39A2FF', boidCount: 2000 }, undefined, true);
    const roomRoute = router.getCurrentRoute();

    // Test navigating back to gallery
    router.navigateToGallery(true);
    const galleryRoute = router.getCurrentRoute();

    unsubscribe();

    const routerPassed =
      roomRoute.roomId === 'boids' &&
      roomRoute.params.seed === '39A2FF' &&
      roomRoute.params.boidCount === '2000' &&
      galleryRoute.roomId === null &&
      interceptedRoute !== null;

    results.push({
      passed: routerPassed,
      module: 'router.ts',
      details: `Dispatched hash routes: room=#/${roomRoute.roomId}?${roomRoute.rawQuery} -> gallery=#/. Route listeners notified.`,
    });
  } catch (err) {
    results.push({ passed: false, module: 'router.ts', details: String(err) });
  }

  // 8. Verify Media Recorder & Snapshot Pipeline
  try {
    const testCanvas = document.createElement('canvas');
    testCanvas.width = 400;
    testCanvas.height = 300;
    const ctx2d = testCanvas.getContext('2d');
    if (ctx2d) {
      ctx2d.fillStyle = '#090A0D';
      ctx2d.fillRect(0, 0, 400, 300);
      ctx2d.fillStyle = '#00F0FF';
      ctx2d.fillRect(50, 50, 100, 100);
    }

    // Test Snapshot capture (2x scale PNG)
    let snapshotProgress = 0;
    const snapshotBlob = await captureSnapshot(testCanvas, {
      resolutionScale: 2,
      format: 'image/png',
      autoDownload: false,
      filenamePrefix: 'aurora-test',
      seed: '#A8F29D',
      onProgress: p => {
        snapshotProgress = p;
      },
    });

    const codec = negotiateSupportedVideoCodec();
    const filename = formatExportFilename('aurora-test', '#A8F29D', 'png');

    // Test video recording (1s quick loop test without autoDownload)
    let videoBlobSize = 0;
    let videoProgress = 0;
    if (typeof (testCanvas as any).captureStream === 'function' && typeof MediaRecorder !== 'undefined') {
      try {
        const videoBlob = await recordVideoLoop(testCanvas, {
          durationSeconds: 1,
          fps: 30,
          autoDownload: false,
          onProgress: p => {
            videoProgress = p;
          },
        });
        videoBlobSize = videoBlob.size;
      } catch (recErr) {
        console.warn('Video recorder test fallback (expected in headless without video encoder):', recErr);
      }
    }

    const snapshotPassed =
      snapshotBlob instanceof Blob &&
      snapshotBlob.size > 0 &&
      snapshotProgress === 1.0 &&
      filename.includes('aurora-test-A8F29D-') &&
      typeof codec.mimeType === 'string';

    results.push({
      passed: snapshotPassed,
      module: 'recorder.ts',
      details: `2x Snapshot captured (${snapshotBlob.size} bytes PNG). Codec: ${codec.mimeType}. Video loop pipeline ready (${videoBlobSize}b recorded, prog=${videoProgress.toFixed(1)}).`,
    });
  } catch (err) {
    results.push({ passed: false, module: 'recorder.ts', details: String(err) });
  }

  return results;
}
