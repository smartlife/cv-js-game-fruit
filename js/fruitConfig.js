export const FRUITS = {
  basic: {
    image: 'img/watermelon.png',
    score: 1,
    size: 0.15,
  },
  pineapple: {
    image: 'img/pineapple.png',
    score: 1,
    size: 0.2,
  },
  pear: {
    image: 'img/pear.png',
    score: 2,
    size: 0.15, // fraction of screen height
  },
  apple: {
    image: 'img/apple.png',
    score: 3,
    size: 0.12, // fraction of screen height
  },
  mandarine: {
    image: 'img/mandarine.png',
    score: 4,
    size: 0.08, // fraction of screen height
  },
  blueberry: {
    image: 'img/blueberry.png',
    score: 10,
    size: 0.05, // fraction of screen height
  },
  robot: {
    image: 'img/robot.png',
    score: -10,
    size: 0.25, // fraction of screen height
  },
};

// Loads fruit images to calculate their aspect ratios once.
// Each fruit's aspect ratio is stored on the corresponding config
// object to keep drawing logic simple across modes.
let loadPromise = null;
export function loadFruitAspects() {
  if (loadPromise) return loadPromise;
  loadPromise = Promise.all(Object.keys(FRUITS).map(key => new Promise(resolve => {
    const cfg = FRUITS[key];
    const img = new Image();
    img.src = cfg.image;
    if (img.complete) {
      cfg.aspect = img.naturalWidth / img.naturalHeight;
      resolve();
    } else {
      img.onload = () => {
        cfg.aspect = img.naturalWidth / img.naturalHeight;
        resolve();
      };
      img.onerror = () => resolve();
    }
  })));
  return loadPromise;
}
