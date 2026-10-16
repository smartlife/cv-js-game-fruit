import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateMotion, generateMotion } from './motion.mjs';

// Explicit opt-in suite: long, seeded replays exercise the production sampler
// across display/camera rates. Budgets apply only to these declared noise models,
// not to arbitrary recognition errors or unbounded user-supplied parameters.
test('noise generator is reproducible and invalid parameters fail clearly', () => {
  assert.deepEqual(generateMotion('noise', { duration: 1, seed: 7 }), generateMotion('noise', { duration: 1, seed: 7 }));
  assert.notDeepEqual(generateMotion('noise', { duration: 1, seed: 7 }).samples, generateMotion('noise', { duration: 1, seed: 8 }).samples);
  assert.throws(() => generateMotion('noise', { noiseCorrelation: 1 }));
  assert.throws(() => generateMotion('noise', { noiseStd: -1 }));
});

test('normal jitter: line/ellipse stay red, noise and slow motion stay white', async () => {
  for (const [cameraFps, displayFps] of [[20, 60], [30, 60], [30, 120], [60, 120]]) {
    for (const seed of [1, 7, 42, 99, 1234]) {
      const options = { cameraFps, displayFps, seed, duration: 60, noiseStd: 1.5, noiseCorrelation: 0.6 };
      for (const kind of ['line', 'ellipse', 'noise', 'slow']) {
        const { metrics: m } = await simulateMotion(kind, options);
        const context = JSON.stringify({ kind, options, metrics: m });
        if (kind === 'line' || kind === 'ellipse') assert.ok(m.activeFraction > 0.85, context);
        else {
          assert.ok(m.activeFraction <= 0.002, context);
          assert.ok(m.activationsPerMinute <= 1, context);
        }
        assert.equal(m.estimatedFrames, 60 * cameraFps, context);
      }
    }
  }
});

test('higher jitter has a bounded measured false-positive budget', async () => {
  for (const seed of [1, 7, 42, 99, 1234, 2026, 101, 333, 808, 999]) {
    for (const kind of ['noise', 'slow']) {
      const { metrics: m } = await simulateMotion(kind, { seed, duration: 120, noiseStd: 3 });
      const context = JSON.stringify({ seed, kind, metrics: m });
      assert.ok(m.activeFraction < 0.02, context);
      assert.ok(m.activationsPerMinute <= 15, context);
      assert.ok(m.longestActiveSeconds <= 0.25, context);
    }
  }
});

test('occasional one-frame recognition jumps do not cut', async () => {
  for (const kind of ['line', 'ellipse', 'noise']) {
    const { metrics: m } = await simulateMotion(kind, { duration: 120, jumpRate: 0.1, jumpSize: 0.6 });
    assert.ok(m.jumpFrames > 0);
    assert.equal(m.jumpActive, 0);
    if (kind !== 'noise') assert.ok(m.activeFraction > 0.85);
    else assert.equal(m.activations, 0);
  }
});
