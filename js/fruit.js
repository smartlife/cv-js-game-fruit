import { DEBUG, debug } from './config.js';

// rotation speed range in full turns per second
const ROTATION_SPEED_MIN = 0.03;
const ROTATION_SPEED_MAX = 0.15;

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
    this.angle = Math.random() * Math.PI * 2;
    const rot = ROTATION_SPEED_MIN + Math.random() * (ROTATION_SPEED_MAX - ROTATION_SPEED_MIN);
    const dir = Math.random() < 0.5 ? -1 : 1;
    this.rotationSpeed = rot * dir * Math.PI * 2; // radians per second

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
    this.angle += this.rotationSpeed * dt;
    // per-frame logs removed to avoid spam
  }

  draw(ctx) {
    if (!this.image.complete) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.drawImage(this.image, -this.radius, -this.radius,
      this.radius * 2, this.radius * 2);
    ctx.restore();
    // per-frame logs removed to avoid spam
  }
}
