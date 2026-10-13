import fs from 'node:fs';
import { DEFAULTS, simulateMotion } from './motion.mjs';

// CLI maps explicit numeric flags to the shared deterministic generator. JSON
// export includes every display sample for inspecting paths and red/white runs.
const flags = { duration: 'duration', seed: 'seed', 'camera-fps': 'cameraFps',
  'display-fps': 'displayFps', height: 'height', 'noise-std': 'noiseStd',
  'noise-correlation': 'noiseCorrelation', 'jump-rate': 'jumpRate',
  'jump-size': 'jumpSize', speed: 'speed', 'ellipse-period': 'ellipsePeriod' };
const options = {};
let output = null;
try {
  for (let i = 2; i < process.argv.length; i++) {
    const name = process.argv[i].replace(/^--/, '');
    if (name === 'help') {
      console.log('node simulation/run.mjs [--noise-std PX] [--noise-correlation -1..1] [--duration SECONDS] [--seed INTEGER] [--camera-fps FPS] [--display-fps FPS] [--height PX] [--speed HEIGHTS/SEC] [--ellipse-period SECONDS] [--jump-rate EVENTS/SEC] [--jump-size HEIGHTS] [--output FILE.json]');
      process.exit(0);
    }
    const value = process.argv[++i];
    if (name === 'output' && value) output = value;
    else if (flags[name] && value !== undefined) options[flags[name]] = Number(value);
    else throw Error(`Unknown option or missing value: --${name}`);
  }
  const results = [];
  for (const kind of ['line', 'ellipse', 'slow', 'noise']) results.push(await simulateMotion(kind, options));
  console.log('Parameters:', { ...DEFAULTS, ...options });
  console.table(results.map(({ kind, metrics: m }) => ({ scenario: kind,
    'red %': +(m.activeFraction * 100).toFixed(2), activations: m.activations,
    'activations/min': +m.activationsPerMinute.toFixed(2),
    'longest red seconds': +m.longestActiveSeconds.toFixed(3),
    'camera samples': m.estimatedFrames, 'display samples': m.displayFrames,
    'red jump frames': m.jumpActive })));
  if (output) { fs.writeFileSync(output, JSON.stringify(results)); console.log(`Saved ${output}`); }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
