export const DEBUG = true; // enable debug logs
export const USE_STUB = false; // use synthetic hand movement instead of webcam
// Minimum confidence score for keypoints to be considered valid
export const MIN_KP_SCORE = 0.15;
// Hand movement speed threshold expressed as a fraction of screen height per second
export const ACTIVE_SPEED_FRACTION = 0.3;

export function debug(...args) {
  if (DEBUG) {
    console.log(...args);
  }
}
