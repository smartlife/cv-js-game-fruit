import PoseProcessor from './poseProcessor.js';
import Fruit from './fruit.js';
import { DEBUG, debug } from './config.js';
import { LEVELS, chooseFruit } from './levelConfig.js';
import { FRUITS, loadFruitAspects } from './fruitConfig.js';
import { segmentsClose } from './geometry.js';

function samplePoisson(lambda) {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L);
  return k - 1;
}

export default class GameMode {
  constructor(manager) {
    this.manager = manager;
    this.level = 0;
    this.container = document.getElementById('game-screen');
    this.timerEl = document.getElementById('timer');
    this.scoreEl = document.getElementById('score');
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.video = document.getElementById('game-video');
    this.pose = new PoseProcessor(this.video, this.canvas);
    this.time = 0;
    this.score = 0;
    this.fruits = [];
    this.spawnTimer = 0;
    this.fruitsPerSecond = 1;
    this.animationId = null;
    this.lastTime = 0;
    this.timeSpeed = 1;
    debug('GameMode created');
  }

  // Enter prepares the webcam and loads fruit images so spawn calculations
  // can use the correct aspect ratios for each fruit.
  async enter() {
    this.container.style.display = 'block';
    await Promise.all([this.pose.init(), loadFruitAspects()]);
    this.level = this.manager.level;
    const levelCfg = LEVELS[this.level];
    this.timeSpeed = levelCfg.speed;
    this.fruitsPerSecond = levelCfg.fruitsPerSecond || 1;
    this.finished = false;
    this.timerEl.style.visibility = 'visible';
    this.time = levelCfg.time;
    this.score = 0;
    this.fruits = [];
    this.updateDisplay();
    this.lastTime = performance.now();
    this.loop(this.lastTime);
    debug('GameMode enter');
  }

  exit() {
    this.container.style.display = 'none';
    cancelAnimationFrame(this.animationId);
    this.pose.stop();
    debug('GameMode exit');
  }

  updateDisplay() {
    this.timerEl.textContent = `Time: ${Math.ceil(this.time)}`;
    this.scoreEl.textContent = `Score: ${this.score}`;
  }

  spawnFruit() {
    const cfg = chooseFruit(this.level);
    // Spawn from either side and calculate a parabolic trajectory.
    // 1) pick a random side and starting height
    // 2) choose a peak higher than the start
    // 3) pick a point where the fruit will cross the bottom
    //    (0.5-1.5 screen widths away) and derive velocities
    // Each fruit's display height is a fraction of the screen and the width
    // is scaled by the aspect ratio measured from the loaded image so it
    // appears without distortion.
    const height = this.canvas.height * cfg.size;
    const width = height * cfg.aspect;
    const radius = Math.max(width, height) / 2; // used as bounding circle
    const side = Math.random() < 0.5 ? 'left' : 'right';
    const x = side === 'left' ? -radius : this.canvas.width + radius;

    // parameters controlling spawn randomness
    const startMin = 0.1;  // 10% of screen height
    const startMax = 0.9;  // 90% of screen height
    const peakLimit = 0.95; // 95% of screen height
    const fallMin = 0.5;   // 50% of screen width
    const fallMax = 1.5;   // 150% of screen width

    const startNorm = startMin + Math.random() * (startMax - startMin);
    const peakNorm = startNorm + Math.random() * (peakLimit - startNorm);

    // convert from bottom-based percentage to canvas coordinates
    const startY = this.canvas.height * (1 - startNorm);
    const highestY = this.canvas.height * (1 - peakNorm);

    const g = 800;
    const vy = -Math.sqrt(2 * g * (startY - highestY));

    let fallNorm = fallMin + Math.random() * (fallMax - fallMin); // 0.5-1.5
    if (side === 'right') fallNorm = fallMin - Math.random() * (fallMax - fallMin); // 0.5 to -0.5
    const fallX = this.canvas.width * fallNorm;

    const tCross = (-vy + Math.sqrt(vy * vy + 2 * g * (this.canvas.height - startY))) / g;
    const vx = (fallX - x) / tCross;
    const endVy = vy + g * tCross;

    const fruit = new Fruit(cfg.imageObj || cfg.image, x, startY, vx, vy, width, height, cfg.score, this.canvas.width, cfg.type);
    fruit.highestY = highestY;
    fruit.endVy = endVy;

    this.fruits.push(fruit);
    debug('Spawn fruit', fruit);
  }

  // Fruits can define a `sliceAll` option in their config. When such a
  // fruit is cut all other fruits on screen are removed and a shower of
  // fast-moving pieces is spawned. This method performs that behaviour
  // using the provided fruit as the explosion origin.
  handleSliceAll(fruit) {
    const baseCfg = FRUITS[fruit.type];
    const cfg = baseCfg.sliceAll;
    if (!cfg) return;
    // Remove and score all other fruits currently on screen.
    this.fruits.forEach(other => {
      if (other !== fruit && other.alive && other.type !== 'piece') {
        other.alive = false;
        this.score += other.score;
      }
    });
    // Spawn several pieces flying in random directions.
    const pieceCount = 6;
    for (let i = 0; i < pieceCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = cfg.piecesSpeed * this.canvas.height;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const h = this.canvas.height * baseCfg.size * 0.5;
      const w = h * (cfg.piecesAspect || baseCfg.aspect);
      const p = new Fruit(cfg.piecesImageObj || cfg.piecesImage, fruit.x, fruit.y, vx, vy,
        w, h, 0, null, 'piece');
      this.fruits.push(p);
    }
    this.updateDisplay();
  }

  checkCollisions(hands) {
    const palmR = this.canvas.height * 0.03;
    this.fruits.forEach(f => {
      if (!f.alive) return;
      ['left', 'right'].forEach(side => {
        const h = hands[side];
        if (!h || !h.active) return;
        const p1 = { x: h.prevX, y: h.prevY };
        const p2 = { x: h.x, y: h.y };
        const f1 = { x: f.prevX, y: f.prevY };
        const f2 = { x: f.x, y: f.y };
        const radius = f.boundingRadius + palmR;
        if (segmentsClose(p1, p2, f1, f2, radius)) {
          f.alive = false;
          this.score += f.score;
          debug('Fruit cut', f);
          const cfg = FRUITS[f.type];
          // Pieces spawned from a pomegranate explosion do not exist in
          // the FRUITS config. Guard against undefined so they can be cut
          // without crashing the game.
          if (cfg && cfg.sliceAll) {
            this.handleSliceAll(f);
          } else {
            this.updateDisplay();
          }
        }
      });
    });
    this.fruits = this.fruits.filter(f => f.alive && f.y < this.canvas.height + 100);
  }

  loop = async (timestamp) => {
    const realDt = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;
    if (!this.finished) {
      this.time -= realDt;
      if (this.time <= 0) {
        this.time = 0;
        this.finished = true;
        this.timerEl.style.visibility = 'hidden';
      }
    }
    if (!this.finished) {
      this.spawnTimer += realDt;
      if (this.spawnTimer >= 1) {
        const count = samplePoisson(this.fruitsPerSecond * this.spawnTimer);
        for (let i = 0; i < count; i++) {
          this.spawnFruit();
        }
        this.spawnTimer -= 1;
      }
    }
    const dt = realDt * this.timeSpeed;
    const hands = await this.pose.update(realDt, false);
    this.fruits.forEach(f => f.update(dt));
    this.checkCollisions(hands);

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.fruits.forEach(f => f.draw(this.ctx));
    this.pose.drawPalms(hands);

    this.updateDisplay();

    if (this.finished && this.fruits.length === 0) {
      this.manager.lastScore = this.score;
      this.manager.switchTo('complete');
      return;
    }

    this.animationId = requestAnimationFrame(this.loop);
  };
}
