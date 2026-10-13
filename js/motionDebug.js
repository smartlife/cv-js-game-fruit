import * as config from './config.js';

export const DEBUG_STORAGE_KEY = 'fruit-slice:motion-debug:v1';
const MAX_FRAMES = 1500;

/** Opt-in, bounded coordinate-only recording. Persist once per second rather
 * than blocking every pose sample; stop flushes immediately. Storage failures
 * keep the in-memory download available. A reload restores the last recording,
 * but never automatically resumes capture. No images or webcam video are saved.
 */
export class MotionDebugRecorder {
  constructor(storage = null) {
    this.storage = storage;
    this.recording = false;
    this.error = '';
    this.session = null;
    try {
      const saved = JSON.parse(storage?.getItem(DEBUG_STORAGE_KEY) || 'null');
      if (saved?.schemaVersion === 1 && Array.isArray(saved.frames)) this.session = saved;
    } catch { this.error = 'LocalStorage недоступен или лог повреждён'; }
  }

  start(metadata = {}) {
    this.error = '';
    this.session = { schemaVersion: 1, startedAt: new Date().toISOString(),
      settings: Object.fromEntries(Object.entries(config).filter(([, value]) => typeof value !== 'function')),
      metadata, frames: [] };
    this.recording = true;
    this.lastFlush = -Infinity;
    this.flush();
  }

  append(frame) {
    if (!this.recording) return;
    this.session.frames.push(frame);
    if (this.session.frames.length >= MAX_FRAMES) this.stop('frame-limit');
    else if (frame.timestampMs - this.lastFlush >= 1000) {
      this.flush();
      this.lastFlush = frame.timestampMs;
    }
    this.onChange?.();
  }

  stop(reason = 'user') {
    this.recording = false;
    if (this.session) {
      this.session.stoppedAt = new Date().toISOString();
      this.session.stopReason = reason;
      this.flush();
    }
    this.onChange?.();
  }

  flush() {
    try {
      if (!this.storage) throw new Error('Storage unavailable');
      this.storage.setItem(DEBUG_STORAGE_KEY, this.export());
    } catch { this.error = 'LocalStorage недоступен/заполнен — скачайте лог до закрытия страницы'; }
  }

  export() { return JSON.stringify(this.session); }
}

let storage = null;
try { storage = globalThis.localStorage ?? null; } catch { /* Download still works without storage. */ }
export const motionDebug = new MotionDebugRecorder(storage);

/** Mouse buttons live above every game screen. Downloads use a local Blob,
 * and starting a new recording replaces the previous one only on explicit click.
 */
export function initMotionDebugPanel() {
  const toggle = document.getElementById('motion-debug-toggle');
  const download = document.getElementById('motion-debug-download');
  const status = document.getElementById('motion-debug-status');
  const render = () => {
    toggle.textContent = motionDebug.recording ? 'Остановить запись' : 'Начать новую запись';
    download.disabled = motionDebug.recording || !motionDebug.session;
    status.textContent = `${motionDebug.recording ? '● Запись' : 'Запись выключена'}: ${motionDebug.session?.frames.length || 0} кадров. ${motionDebug.error || (motionDebug.session?.stopReason === 'frame-limit' ? 'Достигнут лимит 1500 кадров — скачайте лог.' : '')}`;
  };
  motionDebug.onChange = render;
  toggle.addEventListener('click', () => {
    if (motionDebug.recording) motionDebug.stop();
    else motionDebug.start({ userAgent: navigator.userAgent, url: location.href,
      viewport: { width: innerWidth, height: innerHeight }, maxFrames: MAX_FRAMES });
    render();
  });
  download.addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([motionDebug.export()], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `fruit-motion-${motionDebug.session.startedAt.replace(/[:.]/g, '-')}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  window.addEventListener('pagehide', () => { if (motionDebug.recording) motionDebug.stop('pagehide'); });
  render();
}
