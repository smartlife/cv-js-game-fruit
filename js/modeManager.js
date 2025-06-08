import { DEBUG, debug } from './config.js';

export default class ModeManager {
  constructor() {
    this.modes = {};
    this.current = null;
    this.level = 0;
    this.lastScore = 0;
    debug('ModeManager created');
  }

  register(name, mode) {
    this.modes[name] = mode;
    debug('Mode registered', name);
  }

  async switchTo(name) {
    if (this.current && this.modes[this.current]) {
      this.modes[this.current].exit();
    }
    this.current = name;
    if (this.modes[name]) {
      await this.modes[name].enter();
    }
    debug('Switched to', name);
  }
}
