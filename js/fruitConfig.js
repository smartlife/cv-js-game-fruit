// FRUITS defines the artwork and gameplay properties of each fruit type. The
// images are preloaded before a level starts so spawning a fruit can use a
// ready-made Image element without waiting for network requests.
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
  pomegranate: {
    image: 'img/pomegranate.png',
    sliceAll: {
      piecesImage: 'img/pomegranate_pieces.png',
      piecesSpeed: 10, // screen heights per second for explosion pieces
    },
    score: 0,
    size: 0.15,
    scoreMessage: 'slices all',
  },
};

// Loads fruit images to calculate their aspect ratios once. The resulting Image
// objects are kept on the config entries so later code can spawn fruits using
// these preloaded elements without additional network requests.
let loadPromise = null;
export function loadFruitAspects() {
  if (loadPromise) return loadPromise;
  loadPromise = Promise.all(Object.keys(FRUITS).map(key => new Promise(resolve => {
    const cfg = FRUITS[key];
    const img = new Image();
    img.src = cfg.image;
    cfg.imageObj = img; // cache loaded object for later use
    if (img.complete) {
      cfg.aspect = img.naturalWidth / img.naturalHeight;
      if (cfg.sliceAll && cfg.sliceAll.piecesImage) {
        const pImg = new Image();
        pImg.src = cfg.sliceAll.piecesImage;
        cfg.sliceAll.piecesImageObj = pImg; // keep reference for later use
        if (pImg.complete) {
          cfg.sliceAll.piecesAspect = pImg.naturalWidth / pImg.naturalHeight;
          resolve();
        } else {
          pImg.onload = () => {
            cfg.sliceAll.piecesAspect = pImg.naturalWidth / pImg.naturalHeight;
            resolve();
          };
          pImg.onerror = () => resolve();
        }
      } else {
        resolve();
      }
    } else {
      img.onload = () => {
        cfg.aspect = img.naturalWidth / img.naturalHeight;
        if (cfg.sliceAll && cfg.sliceAll.piecesImage) {
          const pImg = new Image();
          pImg.src = cfg.sliceAll.piecesImage;
          cfg.sliceAll.piecesImageObj = pImg; // keep reference for later use
          if (pImg.complete) {
            cfg.sliceAll.piecesAspect = pImg.naturalWidth / pImg.naturalHeight;
            resolve();
          } else {
            pImg.onload = () => {
              cfg.sliceAll.piecesAspect = pImg.naturalWidth / pImg.naturalHeight;
              resolve();
            };
            pImg.onerror = () => resolve();
          }
        } else {
          resolve();
        }
      };
      img.onerror = () => resolve();
    }
  })));
  return loadPromise;
}
