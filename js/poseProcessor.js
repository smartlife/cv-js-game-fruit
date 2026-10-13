import { USE_STUB, MIN_KP_SCORE, debug } from './config.js';
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
  }

  /**
   * Initializes the webcam and pose detector.
   * If a callback is provided it is called once the webcam
   * stream is active but before the pose model finishes loading.
   * This allows callers to show a loading state while the
   * MoveNet model downloads.
   */
  async init(onVideoReady = null) {
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

  // Mirror the gameplay coordinate system on the foreground layer and clear
  // old trails even when tracking is lost. Resizing only happens when needed.
  drawPalms(hands) {
    if (this.handCanvas.width !== this.canvas.width) this.handCanvas.width = this.canvas.width;
    if (this.handCanvas.height !== this.canvas.height) this.handCanvas.height = this.canvas.height;
    this.handCtx.clearRect(0, 0, this.handCanvas.width, this.handCanvas.height);
    if (!hands) return;
    const r = this.canvas.height * 0.03;
    ['left', 'right'].forEach(side => {
      const h = hands[side];
      if (!h) return;
      const color = h.active ? 'rgba(255,0,0,0.7)' : 'rgba(255,255,255,0.7)';
      // draw previous position
      this.handCtx.fillStyle = color;
      this.handCtx.beginPath();
      this.handCtx.arc(h.prevX, h.prevY, r, 0, Math.PI * 2);
      this.handCtx.fill();
      // draw connecting segment
      this.handCtx.strokeStyle = color;
      this.handCtx.lineWidth = r * 2;
      this.handCtx.lineCap = 'round';
      this.handCtx.beginPath();
      this.handCtx.moveTo(h.prevX, h.prevY);
      this.handCtx.lineTo(h.x, h.y);
      this.handCtx.stroke();
      // draw current position
      this.handCtx.beginPath();
      this.handCtx.arc(h.x, h.y, r, 0, Math.PI * 2);
      this.handCtx.fill();
    });
  }

  async update(dt, draw = true) {
    const updateStartedMs = performance.now();
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

    if (motionDebug.recording) {
      const timestampMs = performance.now();
      motionDebug.append({ timestampMs, dt, updateStartedMs,
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

