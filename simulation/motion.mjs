import PoseProcessor from '../js/poseProcessor.js';

export const DEFAULTS = {
  duration: 30, seed: 42, cameraFps: 30, displayFps: 120,
  height: 480, noiseStd: 1.5, noiseCorrelation: 0.6,
  jumpRate: 0, jumpSize: 0.6, speed: 0.6, ellipsePeriod: 3
};

/** Seeded Gaussian AR(1) jitter has a stationary standard deviation in pixels
 * per axis and adjustable temporal correlation. Independent random jumps last
 * one camera sample. Noise is generated only for new camera frames, never for
 * display repeats, matching the 30Hz camera / 120Hz display in the recorded log.
 */
export function generateMotion(kind, options = {}) {
  const o = { ...DEFAULTS, ...options };
  if (!['line', 'ellipse', 'slow', 'noise'].includes(kind)) throw Error(`Unknown scenario: ${kind}`);
  for (const name of ['duration', 'cameraFps', 'displayFps', 'height', 'ellipsePeriod']) {
    if (!Number.isFinite(o[name]) || o[name] <= 0) throw Error(`${name} must be positive`);
  }
  for (const name of ['noiseStd', 'jumpRate', 'jumpSize', 'speed']) {
    if (!Number.isFinite(o[name]) || o[name] < 0) throw Error(`${name} must be non-negative`);
  }
  if (!Number.isFinite(o.noiseCorrelation) || Math.abs(o.noiseCorrelation) >= 1) throw Error('noiseCorrelation must be between -1 and 1');
  if (!Number.isInteger(o.seed)) throw Error('seed must be an integer');
  let state = o.seed >>> 0;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return (state + 0.5) / 4294967296; };
  const gaussian = () => Math.sqrt(-2 * Math.log(random())) * Math.cos(2 * Math.PI * random());
  let nx = gaussian() * o.noiseStd, ny = gaussian() * o.noiseStd;
  const innovation = o.noiseStd * Math.sqrt(1 - o.noiseCorrelation ** 2);
  const samples = [];
  for (let i = 0; i < Math.ceil(o.duration * o.cameraFps); i++) {
    const t = i / o.cameraFps;
    nx = nx * o.noiseCorrelation + gaussian() * innovation;
    ny = ny * o.noiseCorrelation + gaussian() * innovation;
    let x = o.height * 2 / 3, y = o.height / 2;
    if (kind === 'line' || kind === 'slow') {
      const span = o.height * 0.75;
      const travel = t * o.height * (kind === 'slow' ? 0.05 : o.speed);
      const phase = travel % (2 * span);
      x += (phase < span ? phase : 2 * span - phase) - span / 2;
    } else if (kind === 'ellipse') {
      const angle = 2 * Math.PI * t / o.ellipsePeriod;
      x += o.height * 0.38 * Math.cos(angle);
      y += o.height * 0.18 * Math.sin(angle);
    }
    const jump = random() < 1 - Math.exp(-o.jumpRate / o.cameraFps);
    const angle = random() * Math.PI * 2;
    samples.push({ t, x: x + nx + (jump ? Math.cos(angle) * o.height * o.jumpSize : 0),
      y: y + ny + (jump ? Math.sin(angle) * o.height * o.jumpSize : 0), jump });
  }
  return { kind, options: o, samples };
}

/** Exercise the production PoseProcessor, including camera timestamps and
 * repeated display frames. A minimal DOM stub only replaces overlay creation;
 * estimatePoses receives synthetic wrist positions. Restore globals afterward.
 * Rates use actual simulated display time, counting transitions separately from
 * red-frame occupancy so a long false activation cannot hide behind a low count.
 */
export async function simulateMotion(kind, options = {}) {
  const simulation = generateMotion(kind, options);
  const o = simulation.options;
  const originalDocument = globalThis.document;
  globalThis.document = { createElement: () => ({ setAttribute() {}, getContext: () => ({}) }) };
  try {
    const width = o.height * 4 / 3;
    const video = { videoWidth: width, videoHeight: o.height, currentTime: 0 };
    const pose = new PoseProcessor(video, { width, height: o.height, getContext: () => ({}),
      closest: () => ({ appendChild() {}, id: 'simulation' }) });
    let sample;
    let estimatedFrames = 0;
    pose.estimate = async () => {
      estimatedFrames++;
      return { keypoints: [{ name: 'right_wrist', x: width - sample.x, y: sample.y, score: 1 }] };
    };
    let activeFrames = 0, activations = 0, wasActive = false, longestActive = 0, run = 0;
    let jumpActive = 0, jumpFrames = 0;
    const timeline = [];
    const count = Math.ceil(o.duration * o.displayFps);
    for (let i = 0; i < count; i++) {
      const t = i / o.displayFps;
      sample = simulation.samples[Math.min(Math.floor(t * o.cameraFps + 1e-8), simulation.samples.length - 1)];
      video.currentTime = sample.t;
      const hand = (await pose.update(1 / o.displayFps, false)).right;
      const active = !!hand?.active;
      activeFrames += active ? 1 : 0;
      if (active && !wasActive) activations++;
      run = active ? run + 1 : 0;
      longestActive = Math.max(longestActive, run);
      if (sample.jump) { jumpFrames++; jumpActive += active ? 1 : 0; }
      timeline.push({ t, cameraTime: sample.t, x: sample.x, y: sample.y, active, jump: sample.jump });
      wasActive = active;
    }
    return { kind, options: o, metrics: { displayFrames: count, estimatedFrames,
      activeFraction: activeFrames / count, activations,
      activationsPerMinute: activations / (count / o.displayFps) * 60,
      longestActiveSeconds: longestActive / o.displayFps, jumpFrames, jumpActive }, timeline };
  } finally {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
}
