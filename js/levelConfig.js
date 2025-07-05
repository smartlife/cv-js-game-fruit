import { FRUITS } from './fruitConfig.js';

export const LEVELS = [

  {
    time: 30,
    fruitsPerSecond: 5,
    speed: 0.5,
    fruits: [
      { type: 'pomegranate', priority: 3 },
      { type: 'apple', priority: 3 },
      { type: 'mandarine', priority: 2 },
      { type: 'blueberry', priority: 0.3 },
    ],
  }, 
];

// chooseFruit returns a random fruit configuration for the given level. Each
// level lists fruit types with associated spawn priorities. The returned object
// also exposes the fruit type so game logic can trigger special behaviours.
export function chooseFruit(level) {
  const list = LEVELS[level].fruits;
  const total = list.reduce((s, f) => s + f.priority, 0);
  let r = Math.random() * total;
  for (const f of list) {
    if (r < f.priority) {
      return { ...FRUITS[f.type], type: f.type };
    }
    r -= f.priority;
  }
  const t = list[0].type;
  return { ...FRUITS[t], type: t };
}
