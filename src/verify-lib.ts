import { createPRNG, hashString, parseSeed, generateRandomSeed } from './lib/prng';
import { detectGPUCapabilities, getGPUTier, getClampedDPR, formatGPUTelemetryBadge } from './lib/gpu';
import { parseHash, serializeHash, parseParams, serializeParams, dampParameter } from './lib/state';
import { audioManager } from './lib/audio';

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

  return results;
}
