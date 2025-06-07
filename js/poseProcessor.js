import { DEBUG, USE_STUB } from './config.js';

export default class PoseProcessor {
  constructor(videoElement, canvasElement) {
    this.video = videoElement;
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
    this.detector = null; // will hold pose detection model
    this.prevLeft = null;
    this.prevRight = null;
  }

  async init() {
    if (USE_STUB) {
      // use synthetic animation instead of webcam
      this.fakeT = 0;
      this.canvas.height = this.video.videoHeight || this.canvas.clientHeight;
      this.canvas.width = this.canvas.height * 4 / 3;
      if (DEBUG) console.log('PoseProcessor using stub');
    } else {
      if (!this.video.srcObject) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        this.video.srcObject = stream;
      }
      await this.video.play();

      if (this.video.readyState < 1) {
        await new Promise(resolve => {
          this.video.addEventListener('loadedmetadata', resolve, { once: true });
        });
      }

      this.canvas.width = this.video.videoHeight * 4 / 3;
      this.canvas.height = this.video.videoHeight;
      if (DEBUG) console.log('Webcam started');
    }

    // load external pose detection library (placeholder)
    if (window.poseDetection) {
      this.detector = await poseDetection.createDetector(
        poseDetection.SupportedModels.MoveNet
      );
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
    ['left', 'right'].forEach(side => {
      const h = hands[side];
      if (!h) return;
      const r = this.canvas.height * 0.03;
      this.ctx.fillStyle = h.active ? 'rgba(255,0,0,0.7)' : 'rgba(255,255,255,0.7)';
      this.ctx.beginPath();
      this.ctx.arc(h.x, h.y, r, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.fillStyle = h.active ? 'red' : 'white';
      this.ctx.font = `${r * 1.2}px sans-serif`;
      this.ctx.fillText(Math.round(h.speed), h.x + r + 2, h.y - r - 2);
    });
    if (DEBUG) console.log('Palms drawn');
  }

  async update(dt, draw = true) {
    let left = null;
    let right = null;
    const threshold = this.canvas.height * 0.1;
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
        if (leftKP && leftKP.score > 0.5) {
          left = { x: leftKP.x * scaleX, y: leftKP.y * scaleY };
        }
        if (rightKP && rightKP.score > 0.5) {
          right = { x: rightKP.x * scaleX, y: rightKP.y * scaleY };
        }
      }
    }

    const hands = { left: null, right: null };
    if (left) {
      const v = this.prevLeft && dt > 0 ? {
        vx: (left.x - this.prevLeft.x) / dt,
        vy: (left.y - this.prevLeft.y) / dt
      } : { vx: 0, vy: 0 };
      const speed = Math.hypot(v.vx, v.vy);
      hands.left = { ...left, ...v, speed, active: speed > threshold };
    }
    if (right) {
      const v = this.prevRight && dt > 0 ? {
        vx: (right.x - this.prevRight.x) / dt,
        vy: (right.y - this.prevRight.y) / dt
      } : { vx: 0, vy: 0 };
      const speed = Math.hypot(v.vx, v.vy);
      hands.right = { ...right, ...v, speed, active: speed > threshold };
    }

    this.prevLeft = left;
    this.prevRight = right;

    if (draw) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.drawPalms(hands);
    }
    if (DEBUG) console.log('Hands', hands);
    return hands;
  }
}
