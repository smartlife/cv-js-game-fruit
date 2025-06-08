import PoseProcessor from './poseProcessor.js';
import Fruit from './fruit.js';
import { DEBUG, debug } from './config.js';
import { LEVELS, chooseFruit } from './levelConfig.js';

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
    this.time = 60;
    this.score = 0;
    this.fruits = [];
    this.spawnTimer = 0;
    this.animationId = null;
    this.lastTime = 0;
    this.timeSpeed = 1;
    debug('GameMode created');
  }

  async enter() {
    this.container.style.display = 'block';
    await this.pose.init();
    this.level = this.manager.level;
    this.timeSpeed = LEVELS[this.level].speed;
    this.finished = false;
    this.timerEl.style.visibility = 'visible';
    this.time = 60;
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
    const radius = this.canvas.height * (cfg.size / 2);
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

    const fruit = new Fruit(cfg.image, x, startY, vx, vy, radius, cfg.score, this.canvas.width);
    fruit.highestY = highestY;
    fruit.endVy = endVy;

    this.fruits.push(fruit);
    debug('Spawn fruit', fruit);
  }

  checkCollisions(hands) {
    this.fruits.forEach(f => {
      if (!f.alive) return;
      ['left', 'right'].forEach(side => {
        const h = hands[side];
        if (!h || !h.active) return;
        const dx = h.x - f.x;
        const dy = h.y - f.y;
        const dist = Math.hypot(dx, dy);
        if (dist < f.radius + 20) {
          f.alive = false;
          this.score += f.score;
          debug('Fruit cut', f);
          this.updateDisplay();
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
      if (this.spawnTimer > 1) {
        this.spawnFruit();
        this.spawnTimer = 0;
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
