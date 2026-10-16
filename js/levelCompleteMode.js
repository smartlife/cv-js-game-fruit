import { recordResult } from './leaderboard.js';
import PoseProcessor from './poseProcessor.js';
import { FRUITS, loadFruitAspects } from './fruitConfig.js';
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
    this.rankingRows = document.getElementById('leaderboard-rows');
    this.continueFruit = document.getElementById('continue-fruit');
    this.continueText = document.getElementById('continue-text');
    this.nextLevelInfo = document.getElementById('next-level-info');
    this.newFruitDescription = document.getElementById('new-fruit-description');
    this.nextLevelLabel = document.getElementById('next-level-label');
    this.newFruitBox = document.getElementById('new-fruit-box');
    this.newFruitImg = document.getElementById('new-fruit-img');
    this.newFruitScore = document.getElementById('new-fruit-score');
    // Continue button uses the basic fruit image. Dimensions are set once
    // fruit images load so the aspect ratio remains natural.
    this.continueFruit.src = FRUITS.basic.image;
    this.pose = new PoseProcessor(this.video, this.canvas);
    this.animationId = null;
    this.lastTime = 0;
    this.buttonReady = false;
    this.showTimeout = null;
    debug('LevelCompleteMode created');
  }

  /**
   * Determines which fruit type is introduced in the next level.
   * Returns `null` if the upcoming level does not add a new fruit or
   * if the current level is the last one.
   */
  getNextNewFruit() {
    if (this.manager.level >= LEVELS.length - 1) return null;
    const current = new Set(LEVELS[this.manager.level].fruits.map(f => f.type));
    const next = LEVELS[this.manager.level + 1].fruits.map(f => f.type);
    for (const t of next) {
      if (!current.has(t)) return t;
    }
    return null;
  }

  // Render all retained runs, highlighting this completion by identity rather
  // than score so equal scores still highlight exactly one enlarged result. Use textContent
  // for stored values; the highlight identifies the current run without a caption.
  renderLeaderboard() {
    const { entries } = recordResult(this.manager.level, this.manager.lastScore);
    this.rankingRows.replaceChildren();
    entries.forEach((entry, index) => {
      const row = document.createElement('tr');
      if (entry.current) row.className = 'current-result';
      const values = [index + 1, '', entry.score];
      values.forEach((value, column) => {
        if (entry.current && column === 1) return;
        const cell = document.createElement('td');
        if (entry.current && column === 0) cell.colSpan = 2;
        cell.textContent = entry.current && column === 0 ? `#${value}` : value;
        if (entry.current && column === 0) cell.id = 'current-rank';
        if (entry.current && column === 2) cell.id = 'final-score';
        if (!entry.current && column === 1) {
          // Use the browser's local date and timezone with a 24-hour clock.
          // Keep the time together so wrapping never splits the clock value.
          const date = new Date(entry.timestamp);
          cell.textContent = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
          const time = document.createElement('span');
          time.className = 'run-time';
          time.textContent = date.toLocaleTimeString(undefined, {
            hour: '2-digit', minute: '2-digit', hour12: false
          });
          cell.appendChild(time);
        }
        row.appendChild(cell);
      });
      this.rankingRows.appendChild(row);
    });
  }

  // Record the completed run once on entry, before asynchronous camera setup.
  // Expand the current run inside the ranking and delay gesture continuation.
  // The final level retains its leaderboard with continuation hidden.
  async enter() {
    this.container.style.display = 'block';
    this.renderLeaderboard();
    await Promise.all([this.pose.init(), loadFruitAspects()]);
    const h = 18;
    this.continueFruit.style.height = `${h}vh`;
    this.continueFruit.style.width = `${h * FRUITS.basic.aspect}vh`;
    const newType = this.getNextNewFruit();
    if (newType) {
      const cfg = FRUITS[newType];
      const nh = 10;
      this.newFruitImg.src = cfg.image;
      const fruitName = newType === 'basic' ? 'Watermelon' : newType[0].toUpperCase() + newType.slice(1);
      this.newFruitDescription.textContent = `New: ${fruitName}`;
      this.newFruitImg.alt = fruitName;
      this.newFruitImg.style.height = `${nh}vh`;
      this.newFruitImg.style.width = `${nh * cfg.aspect}vh`;
      const score = cfg.score;
      if (cfg.scoreMessage) {
        this.newFruitScore.textContent = cfg.scoreMessage;
      } else {
        // Display a '+' only for positive scores so negative values are
        // shown without a redundant sign.
        this.newFruitScore.textContent = score > 0 ? `+${score} points` : `${score} points`;
      }
      this.newFruitBox.style.display = 'flex';
    } else {
      this.newFruitBox.style.display = 'none';
    }
    const levelNum = this.manager.level + 1;
    const isFinal = this.manager.level >= LEVELS.length - 1;
    if (isFinal) {
      this.levelLabel.textContent = 'Game Complete';
    } else {
      this.levelLabel.textContent = `Level ${levelNum} finished`;
    }
    this.nextLevelLabel.textContent = isFinal ? '' : `Next level · ${levelNum + 1}`;
    this.nextLevelInfo.style.display = isFinal ? 'none' : 'block';
    this.continueFruit.style.visibility = 'hidden';
    this.continueText.style.visibility = 'hidden';
    this.buttonReady = false;
    if (isFinal) {
      this.continueFruit.style.display = 'none';
      this.continueText.style.display = 'none';
    } else {
      this.continueFruit.style.display = 'block';
      this.continueText.style.display = 'block';
      this.showTimeout = setTimeout(() => {
        this.continueFruit.style.visibility = 'visible';
        this.continueText.style.visibility = 'visible';
        this.buttonReady = true;
      }, 2000);
    }
    this.lastTime = performance.now();
    this.loop(this.lastTime);
    debug('LevelCompleteMode enter');
  }

  exit = () => {
    this.container.style.display = 'none';
    cancelAnimationFrame(this.animationId);
    clearTimeout(this.showTimeout);
    this.newFruitBox.style.display = 'none';
    this.continueText.style.visibility = 'hidden';
    this.continueFruit.style.display = 'block';
    this.continueText.style.display = 'block';
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
