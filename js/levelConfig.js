import { FRUITS } from './fruitConfig.js';

export const LEVELS = [
  {
    speed: 0.5,
    fruits: [
      { type: 'pineapple', priority: 5 },
      { type: 'pear', priority: 1.5 },
      { type: 'apple', priority: 0.1 },
    ],
  },
  
  {
    speed: 0.6,
    fruits: [
      { type: 'pineapple', priority: 2 },
      { type: 'pear', priority: 2 },
      { type: 'apple', priority: 0.5 },
      { type: 'mandarine', priority: 0.1 },
    ],
  },
  
  {
    speed: 0.7,
    fruits: [
      { type: 'pineapple', priority: 1 },
      { type: 'pear', priority: 2 },
      { type: 'apple', priority: 2 },
      { type: 'mandarine', priority: 0.5 },
    ],
  },    

  {
    speed: 0.8,
    fruits: [
      { type: 'pineapple', priority: 1 },
      { type: 'pear', priority: 2 },
      { type: 'apple', priority: 2 },
      { type: 'mandarine', priority: 1 },
    ],
  },    

  {
    speed: 0.9,
    fruits: [
      { type: 'pineapple', priority: 1 },
      { type: 'pear', priority: 1 },
      { type: 'apple', priority: 1 },
      { type: 'mandarine', priority: 2 },
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
