import { DEBUG, USE_STUB, MIN_KP_SCORE, ACTIVE_SPEED_FRACTION, AUTO_ZOOM,
  ZOOM_SMOOTHING, debug } from './config.js';

// PoseProcessor wraps the pose detection library. It keeps webcam and detector
// instances shared across game screens. When AUTO_ZOOM is enabled the class also
// maintains a crop rectangle describing the zoomed-in region of the video. The
// crop is updated on the start screen and reused for the rest of the session so
// all game coordinates operate on the zoomed view.
export default class PoseProcessor {
  static stream = null;       // shared webcam MediaStream
  static detector = null;     // shared pose detection model
  static crop = { y: 0, height: 0 }; // persistent crop region

  constructor(videoElement, canvasElement) {
    this.video = videoElement;
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
    this.detector = null; // will reference the shared detector
    this.prevLeft = null;
    this.prevRight = null;
    this.crop = { ...PoseProcessor.crop };
  }

  /**
   * Adjust the persistent crop rectangle based on the current pose.
   * The method keeps eyes around 20% from the top and the pelvis
   * near the bottom while ensuring palms remain visible. Updates
   * are smoothed to prevent jittery zoom oscillations.
   */
  updateCrop(pose) {
    if (!AUTO_ZOOM || !pose) return;

    const h = this.video.videoHeight;
    const eyes = pose.keypoints.filter(p =>
      (p.name === 'left_eye' || p.name === 'right_eye') && p.score > MIN_KP_SCORE);
    const hips = pose.keypoints.filter(p =>
      (p.name === 'left_hip' || p.name === 'right_hip') && p.score > MIN_KP_SCORE);
    const wrists = pose.keypoints.filter(p =>
      (p.name === 'left_wrist' || p.name === 'right_wrist') && p.score > MIN_KP_SCORE);

    if (eyes.length === 0 || hips.length === 0) return;

    const eyeY = eyes.reduce((a, b) => a + b.y, 0) / eyes.length;
    const pelvisY = hips.reduce((a, b) => a + b.y, 0) / hips.length;

    let cropHeight = (pelvisY - eyeY) / 0.8;
    cropHeight = Math.min(h, Math.max(h * 0.5, cropHeight));
    let offsetY = eyeY - cropHeight * 0.2;

    if (wrists.length > 0) {
      const minPalm = Math.min(...wrists.map(w => w.y));
      const maxPalm = Math.max(...wrists.map(w => w.y));
      offsetY = Math.min(offsetY, minPalm);
      cropHeight = Math.max(cropHeight, maxPalm - offsetY);
    }

    offsetY = Math.max(0, Math.min(h - cropHeight, offsetY));

    // Smoothly move towards the target crop.
    this.crop.height += (cropHeight - this.crop.height) * ZOOM_SMOOTHING;
    this.crop.y += (offsetY - this.crop.y) * ZOOM_SMOOTHING;

    PoseProcessor.crop = { ...this.crop };

    this.applyCropStyle();
  }

  /**
   * Apply the current crop rectangle to the video and canvas elements
   * by translating and scaling so the cropped region fills the view.
   */
  applyCropStyle() {
    const h = this.video.videoHeight;
    if (!h || !this.crop.height) return;
    const cropW = this.crop.height * 4 / 3;
    const offsetX = (this.video.videoWidth - cropW) / 2;
    const s = h / this.crop.height;
    const tx = -offsetX;
    const ty = -this.crop.y;

    const vidTrans = `scaleX(-1) scale(${s}) translate(${tx}px, ${ty}px)`;
    const canvasTrans = `scale(${s}) translate(${tx}px, ${ty}px)`;

    this.video.style.transformOrigin = 'top left';
    this.canvas.style.transformOrigin = 'top left';
    this.video.style.transform = vidTrans;
    this.canvas.style.transform = canvasTrans;
  }

  async init() {
    if (USE_STUB) {
      // use synthetic animation instead of webcam
      this.fakeT = 0;
      this.canvas.height = this.video.videoHeight || this.canvas.clientHeight;
      this.canvas.width = this.canvas.height * 4 / 3;
      this.applyCropStyle();
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
      this.applyCropStyle();
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

  async update(dt, draw = true, adjustZoom = false) {
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
      if (adjustZoom) this.updateCrop(pose);
      if (pose) {
        const cropH = this.crop.height || this.video.videoHeight;
        const cropW = cropH * 4 / 3;
        const offX = (this.video.videoWidth - cropW) / 2;
        const offY = this.crop.y;
        const scaleX = this.canvas.width / cropW;
        const scaleY = this.canvas.height / cropH;
        const leftKP = pose.keypoints.find(p => p.name === 'left_wrist');
        const rightKP = pose.keypoints.find(p => p.name === 'right_wrist');
        if (leftKP && leftKP.score > MIN_KP_SCORE) {
          const x = (leftKP.x - offX) * scaleX;
          left = { x: this.canvas.width - x, y: (leftKP.y - offY) * scaleY };
        }
        if (rightKP && rightKP.score > MIN_KP_SCORE) {
          const x = (rightKP.x - offX) * scaleX;
          right = { x: this.canvas.width - x, y: (rightKP.y - offY) * scaleY };
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

