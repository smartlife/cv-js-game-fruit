export const DEBUG = true; // enable debug logs
export const USE_STUB = false; // use synthetic hand movement instead of webcam
// Minimum confidence score for keypoints to be considered valid
export const MIN_KP_SCORE = 0.15;
// Multiplier for all in-game physics. Values below 1 slow the action down
// while values above 1 speed it up. Game time shown to the user is not affected.
export const TIME_SPEED = 0.2;

export function debug(...args) {
  if (DEBUG) {
    console.log(...args);
  }
}
