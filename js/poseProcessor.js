import { USE_STUB, MIN_KP_SCORE, SLICE_MAX_SAMPLE_GAP, debug } from './config.js';
import SliceMotion from './sliceMotion.js';
import { motionDebug } from './motionDebug.js';

export default class PoseProcessor {
  static stream = null;       // shared webcam MediaStream
  static detector = null;     // shared pose detection model

  constructor(videoElement, canvasElement) {
    this.video = videoElement;
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
    // Keep cursor artwork outside the camera container's stacking context so
    // it remains visible over headings, the leaderboard, and the game HUD.
    this.handCanvas = document.createElement('canvas');
    this.handCanvas.className = 'hand-overlay';
    this.handCanvas.setAttribute('aria-hidden', 'true');
    this.canvas.closest('.screen').appendChild(this.handCanvas);
    this.handCtx = this.handCanvas.getContext('2d');
    this.detector = null; // will reference the shared detector
    this.motion = { left: new SliceMotion(), right: new SliceMotion() };
    this.resetSampling();
  }

  // A camera frame is one measurement, even when the display refreshes faster.
  // Reset sampling on mode changes so old strokes cannot carry into a new mode.
  resetSampling() {
    this.bladeTrails = { left: [], right: [] };
    this.lastFrameTime = null;
    this.lastSampleWallMs = null;
    this.lastHands = { left: null, right: null };
    this.lastDebugSampleMs = null;
  }

  /**
   * Initializes the webcam and pose detector.
   * If a callback is provided it is called once the webcam
   * stream is active but before the pose model finishes loading.
   * This allows callers to show a loading state while the
   * MoveNet model downloads.
   */
  async init(onVideoReady = null) {
    this.resetSampling();
    this.motion.left.reset();
    this.motion.right.reset();
    if (USE_STUB) {
      // use synthetic animation instead of webcam
      this.fakeT = 0;
      this.canvas.height = this.video.videoHeight || this.canvas.clientHeight;
      this.canvas.width = this.canvas.height * 4 / 3;
      if (onVideoReady) onVideoReady();
      debug('PoseProcessor using stub');
    } else {
      if (!PoseProcessor.stream) {
        PoseProcessor.stream = await navigator.mediaDevices.getUserMedia({ video: true });
        debug('Webcam started');
      }

      if (this.video.srcObject !== PoseProcessor.stream) {
        this.video.srcObject = PoseProcessor.stream;
      }
      await this.video.play();

      if (this.video.readyState < 1) {
        await new Promise(resolve => {
          this.video.addEventListener('loadedmetadata', resolve, { once: true });
        });
      }

      this.canvas.width = this.video.videoHeight * 4 / 3;
      this.canvas.height = this.video.videoHeight;
      if (onVideoReady) onVideoReady();
    }

    // load external pose detection library (placeholder)
    if (window.poseDetection) {
      try {
        if (!PoseProcessor.detector) {
          PoseProcessor.detector = await poseDetection.createDetector(
            poseDetection.SupportedModels.MoveNet
          );
          debug('Pose detector loaded');
        }
        this.detector = PoseProcessor.detector;
      } catch (err) {
        console.error('Failed to load pose detector:', err);
      }
    }
  }

  async estimate() {
    if (USE_STUB) return {};
    if (!this.detector) return null;
    const poses = await this.detector.estimatePoses(this.video, { flipHorizontal: true });
    return poses[0] || null;
  }

  // Keep a separate 240 ms visual history, never reused by collision detection.
  // Only confirmed, moving samples extend the blade; held frames and idle hands
  // let existing artwork fade. Break paths across tracking loss or new strokes.
  drawPalms(hands) {
    const resized = this.handCanvas.width !== this.canvas.width ||
      this.handCanvas.height !== this.canvas.height;
    if (resized) {
      this.handCanvas.width = this.canvas.width;
      this.handCanvas.height = this.canvas.height;
      this.bladeTrails = { left: [], right: [] };
    }
    const ctx = this.handCtx;
    const now = performance.now();
    const lifetime = 240;
    ctx.clearRect(0, 0, this.handCanvas.width, this.handCanvas.height);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const side of ['left', 'right']) {
      const trail = this.bladeTrails[side];
      while (trail.length && now - trail[0].time >= lifetime) trail.shift();
      const hand = hands?.[side];
      const moving = hand?.active && Math.hypot(hand.x - hand.prevX, hand.y - hand.prevY) > 0.01;
      if (moving) {
        const last = trail.at(-1);
        // Repeated renders of one camera sample must not refresh the trail.
        if (!last || last.x !== hand.x || last.y !== hand.y) {
          const connected = last && Math.hypot(last.x - hand.prevX, last.y - hand.prevY) < 0.01;
          if (!connected) trail.push({ x: hand.prevX, y: hand.prevY, time: now, start: true });
          const point = { x: hand.x, y: hand.y, time: now };
          trail.push(point);
          point.tip = this.projectBladeTip(trail);
        }
      }
      // Prediction is artwork only, fixed per new sample rather than advancing
      // every display frame. Its timestamp fades with the measured blade head.
      const head = trail.at(-1);
      const artwork = head?.tip ? [...trail, { ...head.tip, time: head.time }] : trail;
      // Subdivide segments to taper continuously, with a blue halo, icy ribbon
      // and white cutting edge. Spatial taper also gives fresh strokes a fine tail.
      for (let i = 1; i < artwork.length; i++) {
        const a = artwork[i - 1];
        const b = artwork[i];
        if (b.start) continue;
        for (let step = 0; step < 6; step++) {
          const t = (step + 0.5) / 6;
          const freshness = Math.max(0, 1 - (now - (a.time + (b.time - a.time) * t)) / lifetime);
          const taper = Math.min(1, (i - 1 + t) / Math.max(1, artwork.length - 1));
          const strength = freshness * Math.sqrt(taper);
          const width = this.canvas.height * 0.021 * strength * (1 + 0.8 * taper ** 4);
          for (const [scale, color, opacity] of [
            [2.4, '55,135,255', 0.13],
            [1, '100,210,255', 0.65],
            [0.32, '235,250,255', 0.95]
          ]) {
            ctx.strokeStyle = `rgba(${color},${opacity * strength})`;
            ctx.lineWidth = Math.max(0.01, width * scale);
            ctx.beginPath();
            ctx.moveTo(a.x + (b.x - a.x) * step / 6, a.y + (b.y - a.y) * step / 6);
            ctx.lineTo(a.x + (b.x - a.x) * (step + 1) / 6, a.y + (b.y - a.y) * (step + 1) / 6);
            ctx.stroke();
          }
        }
      }
    }
    ctx.restore();
  }

  // Average up to three recent measured segments, favouring the newest one.
  // Stop at stroke boundaries, stale samples or sharp reversals. Scale the
  // short lead by directional coherence to suppress jitter; cap it at 1.8%
  // of video height and 40% of an average step, with a hard 12 canvas-pixel
  // ceiling and the old palm radius (3% of height). Never modify collision hands.
  projectBladeTip(trail) {
    const head = trail.at(-1);
    let dx = 0;
    let dy = 0;
    let travel = 0;
    let weights = 0;
    let latest = null;
    for (let i = trail.length - 1, weight = 3; i > 0 && weight > 0; i--, weight--) {
      const b = trail[i];
      const a = trail[i - 1];
      if (b.start || head.time - a.time > 100) break;
      const x = b.x - a.x;
      const y = b.y - a.y;
      const distance = Math.hypot(x, y);
      if (!distance) continue;
      if (latest && x * latest.x + y * latest.y <= 0) break;
      latest ??= { x, y };
      dx += x * weight;
      dy += y * weight;
      travel += distance * weight;
      weights += weight;
    }
    const length = Math.hypot(dx, dy);
    if (!length || !travel) return null;
    const coherence = length / travel;
    const maxLeadPixels = 12;
    const oldPalmRadius = this.canvas.height * 0.03;
    const lead = Math.min(maxLeadPixels, oldPalmRadius,
      this.canvas.height * 0.018, travel / weights * 0.4) * coherence ** 2;
    return { x: head.x + dx / length * lead, y: head.y + dy / length * lead };
  }

  /** Process each camera timestamp once and use camera elapsed seconds for
   * velocity. Repeated display frames let the visual trail fade and have a zero-length
   * collision segment; replaying the last stroke would cut unrelated fruit.
   * A stalled feed clears tracking after the normal maximum sample gap.
   */
  async update(dt, draw = true) {
    const updateStartedMs = performance.now();
    const renderDt = dt;
    const frameTime = this.video.currentTime;
    if (!USE_STUB && Number.isFinite(frameTime)) {
      if (frameTime === this.lastFrameTime) {
        const stale = (updateStartedMs - this.lastSampleWallMs) / 1000 > SLICE_MAX_SAMPLE_GAP;
        if (stale) {
          this.motion.left.reset();
          this.motion.right.reset();
          this.lastHands = { left: null, right: null };
        }
        const held = Object.fromEntries(Object.entries(this.lastHands).map(([side, hand]) =>
          [side, hand ? { ...hand, prevX: hand.x, prevY: hand.y, vx: 0, vy: 0, speed: 0 } : null]));
        if (draw) {
          this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
          this.drawPalms(held);
        }
        return held;
      }
      dt = this.lastFrameTime == null ? 0 : frameTime - this.lastFrameTime;
      this.lastFrameTime = frameTime;
      this.lastSampleWallMs = updateStartedMs;
    }
    let rawWrists = null;
    let left = null;
    let right = null;
    if (USE_STUB) {
      this.fakeT += dt;
      const amp = this.canvas.height * 0.3;
      const baseY = this.canvas.height * 0.5;
      const y = baseY + Math.sin(this.fakeT * 2) * amp;
      const vy = Math.cos(this.fakeT * 2) * amp * 2;
      left = { x: this.canvas.width * 0.3, y };
      right = { x: this.canvas.width * 0.7, y };
      left.vx = 0; left.vy = vy; left.speed = Math.abs(vy);
      right.vx = 0; right.vy = vy; right.speed = Math.abs(vy);
    } else {
      const pose = await this.estimate();
      if (pose) {
        const scaleX = this.canvas.width / this.video.videoWidth;
        const scaleY = this.canvas.height / this.video.videoHeight;
        const leftKP = pose.keypoints.find(p => p.name === 'left_wrist');
        const rightKP = pose.keypoints.find(p => p.name === 'right_wrist');
        rawWrists = { left: leftKP ? { x: leftKP.x, y: leftKP.y, score: leftKP.score } : null,
          right: rightKP ? { x: rightKP.x, y: rightKP.y, score: rightKP.score } : null };
        if (leftKP && leftKP.score > MIN_KP_SCORE) {
          const x = leftKP.x * scaleX;
          left = { x: this.canvas.width - x, y: leftKP.y * scaleY };
        }
        if (rightKP && rightKP.score > MIN_KP_SCORE) {
          const x = rightKP.x * scaleX;
          right = { x: this.canvas.width - x, y: rightKP.y * scaleY };
        }
      }
    }

    const hands = {
      left: this.motion.left.update(left, dt, this.canvas.height),
      right: this.motion.right.update(right, dt, this.canvas.height)
    };

    this.lastHands = hands;
    if (motionDebug.recording) {
      const timestampMs = performance.now();
      motionDebug.append({ timestampMs, dt, renderDt, frameTime, updateStartedMs,
        processingMs: timestampMs - updateStartedMs,
        sampleIntervalMs: this.lastDebugSampleMs == null ? null : timestampMs - this.lastDebugSampleMs,
        screen: this.canvas.closest('.screen')?.id,
        canvas: { width: this.canvas.width, height: this.canvas.height },
        video: { width: this.video.videoWidth, height: this.video.videoHeight, currentTime: this.video.currentTime },
        rawWrists, hands, diagnostics: { left: this.motion.left.diagnostics, right: this.motion.right.diagnostics } });
      this.lastDebugSampleMs = timestampMs;
    } else this.lastDebugSampleMs = null;

    if (draw) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.drawPalms(hands);
    }
    // debug output removed to avoid per-frame spam
    return hands;
  }

  stop() {
    this.resetSampling();
    this.motion.left.reset();
    this.motion.right.reset();
    if (USE_STUB) return;
    if (this.video && this.video.srcObject) {
      // Only pause playback to keep the shared webcam stream alive
      this.video.pause();
      this.video.srcObject = null;
    }
  }
}

