import test from 'node:test';
import assert from 'node:assert/strict';
import SliceMotion from '../js/sliceMotion.js';
import PoseProcessor from '../js/poseProcessor.js';

// Feed measured positions rather than internal detector state to check real
// gesture shapes, noise, timing and independent wrist tracking.
function run(points, dt = 1 / 60, height = 1000) {
  const motion = new SliceMotion();
  return points.map(point => motion.update(point, dt, height));
}
const point = (x, y = 0) => ({ x, y });

test('a straight stroke requires three fast steps and stays active', () => {
  assert.deepEqual(run([0, 20, 40, 60, 80].map(x => point(x))).map(h => h.active),
    [false, false, false, true, true]);
});

test('smooth arcs remain valid as their direction turns', () => {
  const points = Array.from({ length: 16 }, (_, i) => point(
    100 * Math.cos(i * Math.PI / 12), 100 * Math.sin(i * Math.PI / 12)));
  assert.ok(run(points).slice(3).every(h => h.active));
});

test('stationary noise, isolated jumps, slow motion and small bursts cannot slice', () => {
  for (const points of [
    [0, 20, -20, 20, -20, 0], [0, 0, 100, 0, 0, 0],
    [0, 2, 4, 6, 8, 10], [0, 6, 12, 18]
  ]) assert.ok(run(points.map(x => point(x))).every(h => !h.active));
  assert.ok(run([0, 20, 40, 60].map(x => point(x)), 0.1).every(h => !h.active));
});

test('a reversal immediately disables slicing; a short stop gets a grace period', () => {
  assert.deepEqual(run([0, 20, 40, 60, 40, 20, 0, 0].map(x => point(x))).map(h => h.active),
    [false, false, false, true, false, false, true, true]);
});

test('lost tracking, invalid timing and pauses cannot bridge a stroke', () => {
  for (const gap of [0, -1, NaN, Infinity, 0.2]) {
    const motion = new SliceMotion();
    for (const x of [0, 20, 40, 60]) motion.update(point(x), 1 / 60, 1000);
    const reacquired = motion.update(point(500), gap, 1000);
    assert.equal(reacquired.active, false);
    assert.equal(reacquired.prevX, 500);
    assert.equal(motion.update(point(520), 1 / 60, 1000).active, false);
  }
  assert.deepEqual(run([point(0), point(20), point(40), point(60), null, point(500), point(520)])
    .map(h => h?.active ?? null), [false, false, false, true, null, false, false]);
});

test('thresholds scale with resolution and require sustained motion at high FPS', () => {
  for (const height of [480, 720, 1080]) {
    for (const fps of [30, 60, 120]) {
      const points = Array.from({ length: 20 }, (_, i) => point(i * height * 0.6 / fps));
      const hands = run(points, 1 / fps, height);
      assert.ok(hands.slice(0, 3).every(h => !h.active));
      assert.equal(hands.at(-1).active, true);
    }
  }
});

test('PoseProcessor applies confirmation independently to both hands', async (t) => {
  // Stub only the overlay DOM wiring introduced by the cursor rendering change.
  const originalDocument = globalThis.document;
  globalThis.document = { createElement: () => ({
    setAttribute() {}, getContext: () => ({})
  }) };
  t.after(() => {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  });
  const canvas = { width: 1000, height: 1000, getContext: () => ({}),
    closest: () => ({ appendChild() {} }) };
  const pose = new PoseProcessor({ videoWidth: 1000, videoHeight: 1000 }, canvas);
  let i = 0;
  pose.estimate = async () => ({ keypoints: [
    { name: 'left_wrist', x: i * 20, y: 100, score: 1 },
    { name: 'right_wrist', x: i % 2 ? 120 : 100, y: 100, score: 1 }
  ] });
  for (; i < 6; i++) {
    const hands = await pose.update(1 / 60, false);
    assert.equal(hands.left.active, i >= 3);
    assert.equal(hands.right.active, false);
  }
  pose.stop();
  assert.equal((await pose.update(1 / 60, false)).left.active, false);
});


test('broad moderate strokes stay active despite speed dips and stalled estimates', () => {
  const xs = [0, 12, 24, 36];
  for (let i = 0; i < 12; i++) xs.push(xs.at(-1) + (i % 3 === 0 ? 0 : 6));
  assert.ok(run(xs.map(x => point(x))).slice(3).every(h => h.active));
  const stopped = run([0, 12, 24, 36, ...Array(12).fill(36)].map(x => point(x)));
  assert.equal(stopped.at(-1).active, false);
});

test('moderate wide arcs work across tracking rates', () => {
  for (const fps of [20, 30, 60, 120]) {
    const points = Array.from({ length: fps }, (_, i) => point(
      300 * Math.cos(i / fps * 1.2), 300 * Math.sin(i / fps * 1.2)));
    assert.ok(run(points, 1 / fps).slice(Math.ceil(fps * 0.15)).every(h => h.active));
  }
});
