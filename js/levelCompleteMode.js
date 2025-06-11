import PoseProcessor from './poseProcessor.js';
import { FRUITS } from './fruitConfig.js';
import { LEVELS } from './levelConfig.js';
import { debug } from './config.js';
import { segmentRectIntersect } from './geometry.js';

export default class LevelCompleteMode {
  constructor(manager) {
    this.manager = manager;
    this.container = document.getElementById('complete-screen');
    this.video = document.getElementById('complete-video');
    this.canvas = document.getElementById('complete-canvas');
    this.levelLabel = document.getElementById('level-finished');
    this.scoreLabel = document.getElementById('final-score');
    this.continueFruit = document.getElementById('continue-fruit');
    this.continueFruit.src = FRUITS.basic.image;
    const size = `${FRUITS.basic.size * 100}vh`;
    this.continueFruit.style.width = size;
    this.continueFruit.style.height = size;
    this.pose = new PoseProcessor(this.video, this.canvas);
    this.animationId = null;
    this.lastTime = 0;
    this.buttonReady = false;
    this.showTimeout = null;
    debug('LevelCompleteMode created');
  }

  async enter() {
    this.container.style.display = 'block';
    await this.pose.init();
    const levelNum = this.manager.level + 1;
    if (this.manager.level >= LEVELS.length - 1) {
      this.levelLabel.textContent = 'Game Complete';
    } else {
      this.levelLabel.textContent = `Level ${levelNum} finished`;
    }
    this.scoreLabel.textContent = `Score: ${this.manager.lastScore}`;
    this.continueFruit.style.visibility = 'hidden';
    this.buttonReady = false;
    this.showTimeout = setTimeout(() => {
      this.continueFruit.style.visibility = 'visible';
      this.buttonReady = true;
    }, 1000);
    this.lastTime = performance.now();
    this.loop(this.lastTime);
    debug('LevelCompleteMode enter');
  }

  exit = () => {
    this.container.style.display = 'none';
    cancelAnimationFrame(this.animationId);
    clearTimeout(this.showTimeout);
    this.pose.stop();
    debug('LevelCompleteMode exit');
  };

  handleContinue = () => {
    if (this.manager.level >= LEVELS.length - 1) {
      this.manager.level = 0;
      this.manager.switchTo('start');
    } else {
      this.manager.level++;
      this.manager.switchTo('game');
    }
  };

  loop = async (timestamp) => {
    const dt = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;
    const hands = await this.pose.update(dt);
    this.checkCut(hands);
    if (this.manager.current === 'complete') {
      this.animationId = requestAnimationFrame(this.loop);
    }
  };

  checkCut(hands) {
    if (!this.buttonReady || !hands) return;
    const rect = this.continueFruit.getBoundingClientRect();
    const canvasRect = this.canvas.getBoundingClientRect();
    ['left', 'right'].forEach(side => {
      const h = hands[side];
      if (!h) return;
      const x1 = canvasRect.left + (h.prevX / this.canvas.width) * canvasRect.width;
      const y1 = canvasRect.top + (h.prevY / this.canvas.height) * canvasRect.height;
      const x2 = canvasRect.left + (h.x / this.canvas.width) * canvasRect.width;
      const y2 = canvasRect.top + (h.y / this.canvas.height) * canvasRect.height;
      if (h.active && segmentRectIntersect({x: x1, y: y1}, {x: x2, y: y2}, rect)) {
        this.handleContinue();
      }
    });
  }
}
