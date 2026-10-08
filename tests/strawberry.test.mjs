import test from 'node:test';
import assert from 'node:assert/strict';
import GameMode from '../js/gameMode.js';

// Exercise gameplay methods without a webcam or DOM; the real constructor only
// wires those dependencies, while these tests cover boost timing and spawning.
function game(time = 30) {
  const mode = Object.create(GameMode.prototype);
  Object.assign(mode, {
    level: 0, time, finished: false, fruitsPerSecond: 1,
    spawnBoostRemaining: 0, spawnBoostMultiplier: 1,
  });
  return mode;
}


test('boost preserves ten seconds of extra spawns at the level deadline', () => {
  for (const time of [30, 10, 5, 0.25]) {
    const mode = game(time);
    mode.handleSpawnBoost({ type: 'strawberry' });
    assert.equal(mode.spawnBoostRemaining, Math.min(time, 10));
    assert.equal((mode.spawnBoostMultiplier - 1) * mode.spawnBoostRemaining, 10);
    mode.handleSpawnBoost({ type: 'strawberry' });
    assert.equal((mode.spawnBoostMultiplier - 1) * mode.spawnBoostRemaining, 10);
  }
  const finished = game(0);
  finished.handleSpawnBoost({ type: 'strawberry' });
  assert.equal(finished.spawnBoostRemaining, 0);
});


test('Poisson integration includes fractional deadlines and splits boost expiry', () => {
  const originalRandom = Math.random;
  let seed = 42;
  // A reproducible random stream checks the actual spawn distribution against
  // its expected budget, rather than duplicating the implementation formula.
  Math.random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  try {
    for (const [time, elapsed, expected] of [[5, 20, 15], [0.25, 1, 10.25], [30, 12, 22]]) {
      let count = 0;
      const trials = 10000;
      for (let i = 0; i < trials; i++) {
        const mode = game(time);
        mode.handleSpawnBoost({ type: 'strawberry' });
        mode.spawnFruit = () => count++;
        mode.advanceSpawning(elapsed);
        assert.equal(mode.spawnBoostRemaining, 0);
      }
      assert.ok(Math.abs(count / trials - expected) < 0.2, `${count / trials} vs ${expected}`);
    }
  } finally {
    Math.random = originalRandom;
  }
});

test('two hands cutting the same strawberry award score only once', () => {
  const mode = game();
  mode.canvas = { height: 100 };
  mode.score = 0;
  mode.spawnQueue = [];
  mode.updateDisplay = () => {};
  mode.fruits = [{ type: 'strawberry', alive: true, score: 1,
    prevX: 10, prevY: 10, x: 10, y: 10, boundingRadius: 5 }];
  const hand = { active: true, prevX: 0, prevY: 10, x: 20, y: 10 };
  mode.checkCollisions({ left: hand, right: hand });
  assert.equal(mode.score, 1);
  assert.equal(mode.spawnBoostRemaining, 10);
  assert.equal(mode.fruits.length, 0);
});
