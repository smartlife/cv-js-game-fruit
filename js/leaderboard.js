const LIMIT = 10;
const PREFIX = 'fruit-slice:leaderboard:v1:';
const memory = new Map();

// Keep chronological history per level, trimming before ranking so old high
// scores expire too. Memory preserves play when browser storage is unavailable;
// malformed saved entries are ignored. Newest runs win ties deterministically.
export function recordResult(level, score) {
  const key = `${PREFIX}${level}`;
  let history = memory.get(key) || [];
  let storage;
  try {
    storage = globalThis.localStorage;
    const saved = storage?.getItem(key);
    if (!memory.has(key) && saved !== null && saved !== undefined) {
      const parsed = JSON.parse(saved);
      history = Array.isArray(parsed) ? parsed.filter(entry =>
        entry && Number.isFinite(entry.score) && Number.isFinite(entry.timestamp)) : [];
    }
  } catch { /* Continue with the session history if storage cannot be read. */ }
  const current = { score, timestamp: Date.now() };
  history = [...history.slice(-(LIMIT - 1)), current];
  memory.set(key, history);
  let persisted = false;
  try {
    if (storage) {
      storage.setItem(key, JSON.stringify(history));
      persisted = true;
    }
  } catch { /* A quota or privacy restriction must not interrupt the game. */ }
  const entries = history.map((entry, index) => ({ ...entry, current: entry === current, index }))
    .sort((a, b) => b.score - a.score || b.index - a.index);
  return { entries, rank: entries.findIndex(entry => entry.current) + 1, persisted };
}
