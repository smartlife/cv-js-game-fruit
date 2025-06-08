import { DEBUG, debug } from './config.js';

export default class Fruit {
  constructor(image, x, y, vx, vy, radius, score = 1, canvasWidth = null) {
    this.image = new Image();
    this.image.src = image;
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.gravity = 800; // px per second^2
    this.radius = radius;
    this.score = score;
    this.alive = true;
    this.highestY = null;
    this.endVy = null;

    if (canvasWidth !== null) {
      const tPeak = -this.vy / this.gravity;
      this.highestY = this.y + this.vy * tPeak + 0.5 * this.gravity * tPeak ** 2;
      const distX = canvasWidth + this.radius * 2;
      const tCross = distX / Math.abs(this.vx);
      this.endVy = this.vy + this.gravity * tCross;
    }

    debug('Fruit created', this);
  }

  update(dt) {
    this.vy += this.gravity * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    // per-frame logs removed to avoid spam
  }

  draw(ctx) {
    if (!this.image.complete) return;
    ctx.drawImage(this.image, this.x - this.radius, this.y - this.radius,
      this.radius * 2, this.radius * 2);
    // per-frame logs removed to avoid spam
  }
}
