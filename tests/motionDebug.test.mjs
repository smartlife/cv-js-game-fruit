import test from 'node:test';
import assert from 'node:assert/strict';
import { MotionDebugRecorder, DEBUG_STORAGE_KEY } from '../js/motionDebug.js';

// Verify persistence and export with the same recorder used by the browser UI,
// including quota failures and the cap that bounds storage and serialization.
test('recording is opt-in, persists on stop and survives reload without resuming', () => {
  const data = new Map();
  const storage = { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) };
  const recorder = new MotionDebugRecorder(storage);
  recorder.append({ timestampMs: 0 });
  assert.equal(recorder.session, null);
  recorder.start({ example: 'sweep' });
  recorder.append({ timestampMs: 10, dt: 0.02, hands: { left: { active: false } } });
  recorder.append({ timestampMs: 20, dt: 0.02, hands: { left: { active: true } } });
  recorder.stop();
  recorder.append({ timestampMs: 30 });
  const exported = JSON.parse(recorder.export());
  assert.equal(exported.frames.length, 2);
  assert.equal(exported.settings.ACTIVE_SPEED_FRACTION, 0.25);
  assert.equal(exported.stopReason, 'user');
  assert.equal(data.get(DEBUG_STORAGE_KEY), recorder.export());
  const restored = new MotionDebugRecorder(storage);
  assert.deepEqual(restored.session, exported);
  assert.equal(restored.recording, false);
});

test('quota failure preserves downloadable frames and frame limit stops capture', () => {
  const recorder = new MotionDebugRecorder({ getItem: () => null, setItem() { throw Error('Quota'); } });
  recorder.start();
  for (let i = 0; i < 1600; i++) recorder.append({ timestampMs: i * 20 });
  assert.equal(recorder.recording, false);
  assert.equal(JSON.parse(recorder.export()).frames.length, 1500);
  assert.equal(recorder.session.stopReason, 'frame-limit');
  assert.ok(recorder.error);
});
