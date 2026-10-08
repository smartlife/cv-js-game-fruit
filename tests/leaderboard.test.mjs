import test from 'node:test';
import assert from 'node:assert/strict';
import { recordResult } from '../js/leaderboard.js';

const saved = new Map();
globalThis.localStorage = {
  getItem: key => saved.get(key) ?? null,
  setItem: (key, value) => saved.set(key, value),
};

test('expires the oldest run even when it was the best and isolates levels', () => {
  recordResult(100, 999);
  for (let score = 1; score <= 10; score++) recordResult(100, score);
  const result = recordResult(100, -1);
  assert.equal(result.entries.length, 10);
  assert.equal(result.rank, 10);
  assert.equal(result.entries.some(entry => entry.score === 999), false);
  assert.equal(result.entries.some(entry => entry.score === 1), false);
  assert.equal(recordResult(101, 2).entries.length, 1);
  assert.equal(JSON.parse(saved.get('fruit-slice:leaderboard:v1:100')).length, 10);
});

test('ties put the current run first and highlight it only once', () => {
  recordResult(102, 4);
  const result = recordResult(102, 4);
  assert.equal(result.rank, 1);
  assert.equal(result.entries.filter(entry => entry.current).length, 1);
});

test('loads persisted runs and ignores malformed history', () => {
  saved.set('fruit-slice:leaderboard:v1:103', JSON.stringify([{score: 42, timestamp: 1}, null, {score: 'bad'}]));
  assert.equal(recordResult(103, 5).rank, 2);
  saved.set('fruit-slice:leaderboard:v1:104', '{broken');
  assert.equal(recordResult(104, 5).entries.length, 1);
});

test('unavailable storage keeps session history and does not interrupt play', () => {
  const storage = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', {configurable: true, get() { throw new Error('blocked'); }});
  try {
    recordResult(105, 10);
    const result = recordResult(105, 5);
    assert.equal(result.rank, 2);
    assert.equal(result.persisted, false);
  } finally {
    Object.defineProperty(globalThis, 'localStorage', {configurable: true, writable: true, value: storage});
  }
});
