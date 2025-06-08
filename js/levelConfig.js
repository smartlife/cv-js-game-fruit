import { FRUITS } from './fruitConfig.js';

export const LEVELS = [
  {
    speed: 0.2,
    fruits: [
      { type: 'basic', priority: 1 },
    ],
  },
];

// utility to pick a fruit based on priorities
export function chooseFruit(level) {
  const list = LEVELS[level].fruits;
  const total = list.reduce((s, f) => s + f.priority, 0);
  let r = Math.random() * total;
  for (const f of list) {
    if (r < f.priority) return FRUITS[f.type];
    r -= f.priority;
  }
  return FRUITS[list[0].type];
}
