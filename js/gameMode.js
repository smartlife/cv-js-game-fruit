import PoseProcessor from './poseProcessor.js';
import Fruit from './fruit.js';
import { DEBUG, debug, TIME_SPEED } from './config.js';

export default class GameMode {
  constructor(manager) {
    this.manager = manager;
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
    debug('GameMode created');
  }

  async enter() {
    this.container.style.display = 'block';
    await this.pose.init();
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
    debug('GameMode exit');
  }

  updateDisplay() {
    this.timerEl.textContent = `Time: ${this.time.toFixed(1)}`;
    this.scoreEl.textContent = `Score: ${this.score}`;
  }

  spawnFruit() {
    const radius = this.canvas.height * 0.05;
    const side = Math.random() < 0.5 ? 'left' : 'right';
    const x = side === 'left' ? -radius : this.canvas.width + radius;

    const vxMag = 200 + Math.random() * 200;
    const vx = side === 'left' ? vxMag : -vxMag;

    // choose peak between 10% and 45% of the screen height
    const peakMin = this.canvas.height * 0.1;
    const peakMax = this.canvas.height * 0.45;
    const highestY = peakMin + Math.random() * (peakMax - peakMin);

    const y = highestY + Math.random() * (this.canvas.height * 0.5 - highestY);

    const g = 800;
    const vy = -Math.sqrt(2 * g * (y - highestY));

    const distX = this.canvas.width + radius * 2;
    const tCross = distX / vxMag;
    const endVy = vy + g * tCross;

    const fruit = new Fruit('fruit.png', x, y, vx, vy, radius, 1, this.canvas.width);
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
    this.time -= realDt;
    if (this.time <= 0) {
      this.manager.switchTo('start');
      return;
    }
    this.spawnTimer += realDt;
    if (this.spawnTimer > 1) {
      this.spawnFruit();
      this.spawnTimer = 0;
    }
    const dt = realDt * TIME_SPEED;
    const hands = await this.pose.update(realDt, false);
    this.fruits.forEach(f => f.update(dt));
    this.checkCollisions(hands);

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.fruits.forEach(f => f.draw(this.ctx));
    this.pose.drawPalms(hands);

    this.updateDisplay();
    this.animationId = requestAnimationFrame(this.loop);
  };
}
