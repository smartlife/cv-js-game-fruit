import PoseProcessor from './poseProcessor.js';
import { DEBUG } from './config.js';

export default class StartMode {
  constructor(manager) {
    this.manager = manager;
    this.container = document.getElementById('start-screen');
    this.video = document.getElementById('intro-video');
    this.canvas = document.getElementById('intro-canvas');
    this.startBtn = document.getElementById('start-btn');
    this.pose = new PoseProcessor(this.video, this.canvas);
    this.animationId = null;
    this.lastTime = 0;
    if (DEBUG) console.log('StartMode created');
  }

  async enter() {
    this.container.style.display = 'block';
    await this.pose.init();
    this.startBtn.addEventListener('click', this.startGame);
    this.lastTime = performance.now();
    this.loop(this.lastTime);
    if (DEBUG) console.log('StartMode enter');
  }

  exit = () => {
    this.container.style.display = 'none';
    cancelAnimationFrame(this.animationId);
    this.startBtn.removeEventListener('click', this.startGame);
    if (DEBUG) console.log('StartMode exit');
  };

  startGame = () => {
    if (DEBUG) console.log('Switching to game');
    this.manager.switchTo('game');
  };

  loop = async (timestamp) => {
    const dt = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;
    const hands = await this.pose.update(dt);
    this.checkStartCut(hands);
    this.animationId = requestAnimationFrame(this.loop);
    if (DEBUG) console.log('StartMode loop', dt);
  };

  checkStartCut(hands) {
    if (!hands) return;
    const rect = this.startBtn.getBoundingClientRect();
    const canvasRect = this.canvas.getBoundingClientRect();
    ['left', 'right'].forEach(side => {
      const h = hands[side];
      if (!h) return;
      const x = canvasRect.left + (h.x / this.canvas.width) * canvasRect.width;
      const y = canvasRect.top + (h.y / this.canvas.height) * canvasRect.height;
      if (h.active && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        this.startGame();
      }
    });
    if (DEBUG) console.log('Check start cut');
  }
}
