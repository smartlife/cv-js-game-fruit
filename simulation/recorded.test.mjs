import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import PoseProcessor from '../js/poseProcessor.js';
import SliceMotion from '../js/sliceMotion.js';

// Stub browser wiring, while exercising the actual async pose update and its
// frame gate. The fixture contains only anonymous coordinates and timestamps.
function processor(t) {
  const originalDocument = globalThis.document;
  globalThis.document = { createElement: () => ({ setAttribute() {}, getContext: () => ({}) }) };
  t.after(() => {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  });
  const video = { videoWidth: 640, videoHeight: 480, currentTime: 0 };
  const canvas = { width: 640, height: 480, getContext: () => ({}), closest: () => ({ appendChild() {} }) };
  return new PoseProcessor(video, canvas);
}

test('120Hz display repeats do not reset a stroke from a 30Hz camera', async t => {
  const pose = processor(t);
  let x = 50;
  let calls = 0;
  pose.estimate = async () => {
    calls++;
    return { keypoints: [{ name: 'right_wrist', x: 640 - x, y: 100, score: 1 }] };
  };
  for (let frame = 0; frame < 12; frame++) {
    pose.video.currentTime = frame / 30;
    x += 10;
    const hand = (await pose.update(1 / 120, false)).right;
    assert.equal(hand.active, frame >= 3);
    if (frame) assert.ok(Math.abs(hand.speed - 300) < 0.001);
    for (let repeat = 0; repeat < 3; repeat++) {
      const held = (await pose.update(1 / 120, false)).right;
      assert.equal(held.active, hand.active);
      assert.equal(held.prevX, held.x);
      assert.equal(held.prevY, held.y);
    }
  }
  assert.equal(calls, 12);
  pose.lastSampleWallMs = performance.now() - 200;
  assert.equal((await pose.update(1 / 120, false)).right, null);
});

test('recorded sweeps activate but final stationary section stays inactive', async t => {
  const fixture = JSON.parse(fs.readFileSync(new URL('../tests/fixtures/motion-camera-repeats.json', import.meta.url)));
  const pose = processor(t);
  let current;
  pose.estimate = async () => ({ keypoints: ['left', 'right'].flatMap(side =>
    current[side] ? [{ name: `${side}_wrist`, x: 640 - current[side].x, y: current[side].y, score: 1 }] : []) });
  let sweepActive = 0, sweepTotal = 0, quietActive = 0, quietTotal = 0;
  const old = { left: new SliceMotion(), right: new SliceMotion() };
  let oldActive = 0;
  for (const sample of fixture.samples) {
    current = sample;
    pose.video.currentTime = sample.videoTime;
    const hands = await pose.update(sample.dt, false);
    for (const side of ['left', 'right']) oldActive += old[side].update(sample[side], sample.dt, 480)?.active ? 1 : 0;
    if (sample.t >= 1 && sample.t < 6) { sweepTotal++; sweepActive += hands.right?.active ? 1 : 0; }
    if (sample.t >= 10) {
      quietTotal++;
      quietActive += hands.left?.active || hands.right?.active ? 1 : 0;
    }
  }
  assert.equal(oldActive, 0, 'original per-display sampling reproduces the reported white indicator');
  assert.ok(sweepActive / sweepTotal > 0.6, `${sweepActive}/${sweepTotal} sweep frames active`);
  assert.equal(quietActive, 0, `${quietTotal} quiet frames must remain white`);
});

test('a large recognition jump never produces a cutting segment', () => {
  const motion = new SliceMotion();
  for (const x of [0, 20, 40, 60]) motion.update({ x, y: 100 }, 1 / 30, 480);
  const jumped = motion.update({ x: 500, y: 100 }, 1 / 30, 480);
  assert.equal(jumped.active, false);
  assert.equal(jumped.prevX, jumped.x);
  assert.deepEqual(motion.diagnostics.reasons, ['position-jump']);
});
