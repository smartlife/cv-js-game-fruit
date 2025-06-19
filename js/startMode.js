import PoseProcessor from './poseProcessor.js';
import { DEBUG, debug } from './config.js';
import { FRUITS, loadFruitAspects } from './fruitConfig.js';
import { segmentRectIntersect } from './geometry.js';

export default class StartMode {
  constructor(manager) {
    this.manager = manager;
    this.container = document.getElementById('start-screen');
    this.video = document.getElementById('intro-video');
    this.canvas = document.getElementById('intro-canvas');
    this.startFruit = document.getElementById('start-fruit');
    this.startText = document.getElementById('start-text');
    this.instructionText = document.getElementById('instruction-text');
    // Use the image of the basic fruit for the start button. Dimensions are set
    // once the fruit images have loaded and their aspect ratios are known.
    this.startFruit.src = FRUITS.basic.image;
    this.pose = new PoseProcessor(this.video, this.canvas);
    this.animationId = null;
    this.lastTime = 0;
    debug('StartMode created');
  }

  // Enter initializes the webcam and pose detector. While they load we
  // display a message telling the player to enable their webcam.
  // The fruit and start text stay hidden so the user doesn't see the
  // oversized fruit before its aspect ratio is known. Once everything
  // is ready we hide the instruction text, size the fruit correctly and
  // reveal the start message.
  async enter() {
    this.container.style.display = 'block';
    this.startFruit.style.visibility = 'hidden';
    if (this.startText) this.startText.style.visibility = 'hidden';
    if (this.instructionText) this.instructionText.style.visibility = 'visible';

    await Promise.all([this.pose.init(), loadFruitAspects()]);

    const h = FRUITS.basic.size * 100;
    this.startFruit.style.height = `${h}vh`;
    this.startFruit.style.width = `${h * FRUITS.basic.aspect}vh`;
    this.startFruit.style.visibility = 'visible';
    if (this.startText) this.startText.style.visibility = 'visible';
    if (this.instructionText) this.instructionText.style.visibility = 'hidden';

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
    this.manager.level = 0;
    this.manager.lastScore = 0;
    this.manager.switchTo('game');
  };

  loop = async (timestamp) => {
    const realDt = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;
    const hands = await this.pose.update(realDt, true, true);
    this.checkStartCut(hands);
    if (this.manager.current === 'start') {
      this.animationId = requestAnimationFrame(this.loop);
    }
  };

  checkStartCut(hands) {
    if (!hands) return;
    const rect = this.startFruit.getBoundingClientRect();
    const canvasRect = this.canvas.getBoundingClientRect();
    ['left', 'right'].forEach(side => {
      const h = hands[side];
      if (!h) return;
      const x1 = canvasRect.left + (h.prevX / this.canvas.width) * canvasRect.width;
      const y1 = canvasRect.top + (h.prevY / this.canvas.height) * canvasRect.height;
      const x2 = canvasRect.left + (h.x / this.canvas.width) * canvasRect.width;
      const y2 = canvasRect.top + (h.y / this.canvas.height) * canvasRect.height;
      if (h.active && segmentRectIntersect({x: x1, y: y1}, {x: x2, y: y2}, rect)) {
        this.startGame();
      }
    });
  }
}
