import { FRUITS } from './fruitConfig.js';

export const LEVELS = [
  {
    time: 30,
    fruitsPerSecond: 1.2,
    speed: 0.5,
    fruits: [
      { type: 'pineapple', priority: 5 },
      { type: 'pear', priority: 1 },
      { type: 'apple', priority: 0.1 },
    ],
  },
  
  {
    time: 40,
    fruitsPerSecond: 1.4,
    speed: 0.6,
    fruits: [
      { type: 'pineapple', priority: 2 },
      { type: 'pear', priority: 1 },
      { type: 'apple', priority: 0.5 },
      { type: 'mandarine', priority: 0.1 },
    ],
  },

  {
    time: 50,
    fruitsPerSecond: 1.6,
    speed: 0.7,
    fruits: [
      { type: 'pineapple', priority: 1 },
      { type: 'pear', priority: 2 },
      { type: 'apple', priority: 2 },
      { type: 'mandarine', priority: 0.5 },
    ],
  },

  {
    time: 60,
    fruitsPerSecond: 1.7,
    speed: 0.8,
    fruits: [
      { type: 'pineapple', priority: 1 },
      { type: 'pear', priority: 2 },
      { type: 'apple', priority: 2 },
      { type: 'mandarine', priority: 1 },
    ],
  },

  {
    time: 90,
    fruitsPerSecond: 1.8,
    speed: 0.9,
    fruits: [
      { type: 'pineapple', priority: 1 },
      { type: 'pear', priority: 1 },
      { type: 'apple', priority: 1 },
      { type: 'mandarine', priority: 2 },
    ],
  },    

  {
    time: 30,
    fruitsPerSecond: 3.8,
    speed: 1.,
    fruits: [
      { type: 'pineapple', priority: 1 },
      { type: 'pear', priority: 1 },
      { type: 'apple', priority: 1 },
      { type: 'mandarine', priority: 20 },
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
