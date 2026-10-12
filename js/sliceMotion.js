import {
  ACTIVE_SPEED_FRACTION, SLICE_MIN_STEPS, SLICE_MIN_STEP_FRACTION,
  SLICE_MIN_TRAVEL_FRACTION, SLICE_MIN_DURATION, SLICE_MAX_SAMPLE_GAP,
  SLICE_MIN_DIRECTION_COSINE, SLICE_MIN_STRAIGHTNESS
} from './config.js';

/**
 * Confirm a stroke from several consecutive fast samples rather than one noisy
 * wrist estimate. Compare neighbouring directions to allow smooth arcs, and
 * require net progress to reject jitter that wanders back towards its origin.
 * Keep only a short trailing window so a long arc can continue turning. Slow,
 * tiny or reversing steps restart confirmation; missing samples and pauses
 * also discard the previous position so reacquisition cannot create a slice.
 */
export default class SliceMotion {
  constructor() {
    this.reset();
  }

  reset() {
    this.previous = null;
    this.steps = [];
  }

  update(point, dt, height) {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      this.reset();
      return null;
    }
    const validInterval = Number.isFinite(dt) && dt > 0 && dt <= SLICE_MAX_SAMPLE_GAP;
    const previous = validInterval && this.previous ? this.previous : point;
    const dx = point.x - previous.x;
    const dy = point.y - previous.y;
    const distance = Math.hypot(dx, dy);
    const speed = validInterval ? distance / dt : 0;
    let active = false;
    if (speed > height * ACTIVE_SPEED_FRACTION && distance >= height * SLICE_MIN_STEP_FRACTION) {
      const last = this.steps.at(-1);
      if (last && (dx * last.dx + dy * last.dy) / (distance * last.distance) < SLICE_MIN_DIRECTION_COSINE) {
        this.steps = [];
      }
      this.steps.push({ dx, dy, distance, dt });
      // Retain enough samples to confirm strokes at high frame rates as well.
      while (this.steps.length > SLICE_MIN_STEPS &&
        this.steps.slice(1).reduce((sum, step) => sum + step.dt, 0) >= SLICE_MIN_DURATION &&
        this.steps.slice(1).reduce((sum, step) => sum + step.distance, 0) >= height * SLICE_MIN_TRAVEL_FRACTION) {
        this.steps.shift();
      }
      const travel = this.steps.reduce((sum, step) => sum + step.distance, 0);
      const duration = this.steps.reduce((sum, step) => sum + step.dt, 0);
      const netX = this.steps.reduce((sum, step) => sum + step.dx, 0);
      const netY = this.steps.reduce((sum, step) => sum + step.dy, 0);
      active = this.steps.length >= SLICE_MIN_STEPS && duration >= SLICE_MIN_DURATION &&
        travel >= height * SLICE_MIN_TRAVEL_FRACTION &&
        Math.hypot(netX, netY) / travel >= SLICE_MIN_STRAIGHTNESS;
    } else {
      this.steps = [];
    }
    this.previous = { x: point.x, y: point.y };
    return { ...point, vx: validInterval ? dx / dt : 0, vy: validInterval ? dy / dt : 0,
      speed, active, prevX: previous.x, prevY: previous.y };
  }
}
