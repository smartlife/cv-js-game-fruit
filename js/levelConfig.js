import { FRUITS } from './fruitConfig.js';

export const LEVELS = [
  {
    speed: 0.5,
    fruits: [
      { type: 'apple', priority: 1 },
      { type: 'pear', priority: 0.5 },
      { type: 'pineapple', priority: 1.5 },
      { type: 'mandarine', priority: 0.5 },
    ],
  },
  
  {
    speed: 0.6,
    fruits: [
      { type: 'apple', priority: 1 },
      { type: 'pear', priority: 0.5 },
      { type: 'pineapple', priority: 1.2 },
      { type: 'mandarine', priority: 0.7 },
    ],
  },
  
  {
    speed: 0.7,
    fruits: [
      { type: 'apple', priority: 1 },
      { type: 'pear', priority: 0.5 },
      { type: 'pineapple', priority: 1.1 },
      { type: 'mandarine', priority: 0.8 },
    ],
  },    

  {
    speed: 0.8,
    fruits: [
      { type: 'apple', priority: 1 },
      { type: 'pear', priority: 0.5 },
      { type: 'pineapple', priority: 1.0 },
      { type: 'mandarine', priority: 0.9 },
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
