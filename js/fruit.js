import { DEBUG, debug } from './config.js';

// rotation speed range in full turns per second
const ROTATION_SPEED_MIN = 0.03;
const ROTATION_SPEED_MAX = 0.15;

export default class Fruit {
  // Fruit represents a falling object drawn with its original aspect ratio.
  // `width` and `height` are the display dimensions of the image. A
  // `boundingRadius` is derived from the larger dimension for simplified
  // collision checks and spawn offset. The constructor accepts either an image
  // URL or a preloaded Image object so callers can avoid repeated loads.
  constructor(image, x, y, vx, vy, width, height, score = 1, canvasWidth = null, type = 'unknown', gravity = 800) {
    // `image` may be a string URL or a preloaded Image object.
    if (image instanceof HTMLImageElement) {
      this.image = image;
    } else {
      this.image = new Image();
      this.image.src = image;
    }
    this.x = x;
    this.y = y;
    this.prevX = x;
    this.prevY = y;
    this.vx = vx;
    this.vy = vy;
    this.gravity = gravity; // px per second^2
    this.width = width;
    this.height = height;
    this.boundingRadius = Math.max(width, height) / 2;
    this.score = score;
    this.type = type;
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
      const distX = canvasWidth + this.boundingRadius * 2;
      const tCross = distX / Math.abs(this.vx);
      this.endVy = this.vy + this.gravity * tCross;
    }

    debug('Fruit created', this);
  }

  update(dt) {
    this.prevX = this.x;
    this.prevY = this.y;
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
    ctx.drawImage(this.image, -this.width / 2, -this.height / 2,
      this.width, this.height);
    ctx.restore();
    // per-frame logs removed to avoid spam
  }
}
