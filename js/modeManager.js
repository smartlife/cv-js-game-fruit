import { DEBUG } from './config.js';

export default class ModeManager {
  constructor() {
    this.modes = {};
    this.current = null;
    if (DEBUG) console.log('ModeManager created');
  }

  register(name, mode) {
    this.modes[name] = mode;
    if (DEBUG) console.log('Mode registered', name);
  }

  async switchTo(name) {
    if (this.current && this.modes[this.current]) {
      this.modes[this.current].exit();
    }
    this.current = name;
    if (this.modes[name]) {
      await this.modes[name].enter();
    }
    if (DEBUG) console.log('Switched to', name);
  }
}
