import { DEBUG, USE_STUB, MIN_KP_SCORE, ACTIVE_SPEED_FRACTION, debug } from './config.js';

export default class PoseProcessor {
  static stream = null;       // shared webcam MediaStream
  static detector = null;     // shared pose detection model

  constructor(videoElement, canvasElement) {
    this.video = videoElement;
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
    this.detector = null; // will reference the shared detector
    this.prevLeft = null;
    this.prevRight = null;
  }

  async init() {
    if (USE_STUB) {
      // use synthetic animation instead of webcam
      this.fakeT = 0;
      this.canvas.height = this.video.videoHeight || this.canvas.clientHeight;
      this.canvas.width = this.canvas.height * 4 / 3;
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

  drawPalms(hands) {
    if (!hands) return;
    const r = this.canvas.height * 0.03;
    ['left', 'right'].forEach(side => {
      const h = hands[side];
      if (!h) return;
      const color = h.active ? 'rgba(255,0,0,0.7)' : 'rgba(255,255,255,0.7)';
      // draw previous position
      this.ctx.fillStyle = color;
      this.ctx.beginPath();
      this.ctx.arc(h.prevX, h.prevY, r, 0, Math.PI * 2);
      this.ctx.fill();
      // draw connecting segment
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = r * 2;
      this.ctx.lineCap = 'round';
      this.ctx.beginPath();
      this.ctx.moveTo(h.prevX, h.prevY);
      this.ctx.lineTo(h.x, h.y);
      this.ctx.stroke();
      // draw current position
      this.ctx.beginPath();
      this.ctx.arc(h.x, h.y, r, 0, Math.PI * 2);
      this.ctx.fill();
    });
  }

  async update(dt, draw = true) {
    let left = null;
    let right = null;
    const threshold = this.canvas.height * ACTIVE_SPEED_FRACTION;
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

    const hands = { left: null, right: null };
    if (left) {
      const prev = this.prevLeft || left;
      const v = this.prevLeft && dt > 0 ? {
        vx: (left.x - this.prevLeft.x) / dt,
        vy: (left.y - this.prevLeft.y) / dt
      } : { vx: 0, vy: 0 };
      const speed = Math.hypot(v.vx, v.vy);
      hands.left = { ...left, ...v, speed, active: speed > threshold, prevX: prev.x, prevY: prev.y };
    }
    if (right) {
      const prev = this.prevRight || right;
      const v = this.prevRight && dt > 0 ? {
        vx: (right.x - this.prevRight.x) / dt,
        vy: (right.y - this.prevRight.y) / dt
      } : { vx: 0, vy: 0 };
      const speed = Math.hypot(v.vx, v.vy);
      hands.right = { ...right, ...v, speed, active: speed > threshold, prevX: prev.x, prevY: prev.y };
    }

    this.prevLeft = left;
    this.prevRight = right;

    if (draw) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.drawPalms(hands);
    }
    // debug output removed to avoid per-frame spam
    return hands;
  }

  stop() {
    if (USE_STUB) return;
    if (this.video && this.video.srcObject) {
      // Only pause playback to keep the shared webcam stream alive
      this.video.pause();
      this.video.srcObject = null;
    }
  }
}

