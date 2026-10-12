export const DEBUG = true; // enable debug logs
export const USE_STUB = false; // use synthetic hand movement instead of webcam
// Minimum confidence score for keypoints to be considered valid
export const MIN_KP_SCORE = 0.15;
// Hand movement speed threshold expressed as a fraction of screen height per second
export const ACTIVE_SPEED_FRACTION = 0.5;
// A slice requires a short, coherent run, with distances scaled to video height.
export const SLICE_MIN_STEPS = 3;
export const SLICE_MIN_STEP_FRACTION = 0.003;
export const SLICE_MIN_TRAVEL_FRACTION = 0.04;
export const SLICE_MIN_DURATION = 0.035; // seconds; reject very brief recognition bursts
export const SLICE_MAX_SAMPLE_GAP = 0.15; // seconds; do not bridge tracking pauses
export const SLICE_MIN_DIRECTION_COSINE = 0.5; // up to 60 degrees between steps
export const SLICE_MIN_STRAIGHTNESS = 0.8; // net displacement / travelled distance

export function debug(...args) {
  if (DEBUG) {
    console.log(...args);
  }
}
