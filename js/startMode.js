import PoseProcessor from './poseProcessor.js';
import { DEBUG, debug } from './config.js';

export default class StartMode {
  constructor(manager) {
    this.manager = manager;
    this.container = document.getElementById('start-screen');
    this.video = document.getElementById('intro-video');
    this.canvas = document.getElementById('intro-canvas');
    this.startFruit = document.getElementById('start-fruit');
    this.pose = new PoseProcessor(this.video, this.canvas);
    this.animationId = null;
    this.lastTime = 0;
    debug('StartMode created');
  }

  async enter() {
    this.container.style.display = 'block';
    await this.pose.init();
    this.lastTime = performance.now();
    this.loop(this.lastTime);
    debug('StartMode enter');
  }

  exit = () => {
    this.container.style.display = 'none';
    cancelAnimationFrame(this.animationId);
    this.pose.stop();
    debug('StartMode exit');
  };

  startGame = () => {
    debug('Switching to game');
    this.manager.switchTo('game');
  };

  loop = async (timestamp) => {
    const dt = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;
    const hands = await this.pose.update(dt);
    this.checkStartCut(hands);
    this.animationId = requestAnimationFrame(this.loop);
  };

  checkStartCut(hands) {
    if (!hands) return;
    const rect = this.startFruit.getBoundingClientRect();
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
  }
}
