# cv-js-game-fruit

Browser webcam game for catching fruits.

This repository now contains the initial structure of a pose‑controlled fruit cutting game. The game runs entirely in the browser and relies on the webcam to track the player's palms.

## Overview

- **index.html** – loads external pose detection libraries and switches between different game modes.
- **js/poseProcessor.js** – wrapper around pose detection library. Initializes the webcam stream and pose detector once and draws highlighted palms.
- **js/config.js** – global configuration with a `DEBUG` flag, `USE_STUB` to simulate movement without a webcam and `ACTIVE_SPEED_FRACTION` controlling how fast a hand must move to become active.
- **js/sliceMotion.js** – confirms a slice from consecutive fast, directionally coherent wrist movements, allowing smooth arcs and rejecting recognition jitter.
- **js/fruitConfig.js** – list of available fruits with image and size. Each
  fruit's aspect ratio is measured when the image loads.
- **js/levelConfig.js** – game levels defining speed, duration, spawn rate and prioritized fruit choices.
- **js/modeManager.js** – simple controller used to register and switch between modes.
- **js/startMode.js** – displays the intro screen with live webcam feed. Cutting the start button with a fast hand movement begins the game.
- **js/fruit.js** – small physics object representing a falling fruit.
- **js/gameMode.js** – real‑time game loop that updates the timer, fruits and palm positions every frame.
- **img/** – folder with fruit images. The `basic` entry in `js/fruitConfig.js`
  provides the image used for the start button. Fruit images are loaded once at
  startup to determine their aspect ratios so visuals render without distortion.

The code is written in small modules so that additional modes (for example a score screen or settings) can be added later by registering new mode classes with `ModeManager`.

## Running

Serve the repository over HTTP and open `index.html` in a modern browser. For example you can run `npx serve` from the project root. The page will request webcam permissions and show the start screen. Fast palm movements are detected using pose estimation. Slice through the start button with a quick hand motion to begin. Each level defines its own duration and how many fruits appear per second. During the round fruits spawn from the sides of the screen following a Poisson distribution and fall with gravity. Cutting them by moving your hand quickly across a fruit awards score.

The game scales all visuals according to the height of the video feed. The feed is cropped to a 4:3 ratio and displayed full-screen with black borders if necessary. If you set `USE_STUB` to `true` in `js/config.js`, the game will generate mock hand motion so you can test without a webcam. Enable `DEBUG` for verbose console logging from all modules.
If the MoveNet model fails to load because of CORS restrictions, download the model files locally and update the paths in `js/poseProcessor.js`.

Edit `js/levelConfig.js` to tweak the game speed, duration, spawn rate or change which fruits appear in each level. The webcam stream and pose detector are kept alive across modes so they only need to initialize once.

Cutting a strawberry awards no points and triples the fruit spawn rate for
10 real seconds. It does not change the fruits' movement speed. If less time
remains, the multiplier is `1 + 20 / remainingSeconds`, preserving the expected
extra twenty seconds of normal spawns. Strawberries do not spawn during the
boost, and strawberries already on screen cannot stack or refresh it. The
next-level preview explains the effect when introducing strawberries.
Configure this effect with `spawnBoost.duration` and `spawnBoost.multiplier`
in `js/fruitConfig.js`.

Run gameplay checks with Node.js 22 or newer: `node --test tests/*.test.mjs`.

Each level completion shows its score, current rank, and the full leaderboard of
the last ten runs for that level. History is stored in browser `localStorage`
under `fruit-slice:leaderboard:v1:<level index>`. The oldest run expires even if
it has the highest score; retained runs rank by descending score, with the newest
run first on ties. If storage is blocked or full, results remain in memory for
the session and the completion screen shows a notice.

Slicing requires at least three consecutive fast movements, at least 35 ms of
motion and travel of 2.5% of the video height. Neighbouring steps may turn by up
to about 80 degrees, and net displacement must be at least 65% of travelled distance
in the trailing confirmation window, allowing smooth arcs while rejecting
back-and-forth jitter. Activation requires 25% of video height per second; confirmed strokes can
continue at 12% per second and tolerate stalled estimates for up to 80 ms.
Longer stops, reversals, missing wrists, and sample gaps over 150 ms reset
confirmation. The same detector controls the start
button and fruit slicing, separately for each hand. Tune the `SLICE_*` constants
in `js/config.js` together with `ACTIVE_SPEED_FRACTION`.

Temporary motion diagnostics: set `SHOW_MOTION_DEBUG_PANEL = true` in
`js/config.js` to reveal the panel (hidden by default), then use the mouse buttons in the bottom-left panel to
start a new recording, stop it, then download JSON. Recording is off by default
and stays stopped after reload. The last recording is stored under
`fruit-slice:motion-debug:v1` in LocalStorage, flushed once per second and on
stop. Starting again replaces it. Capture stops at 1500 frames to bound storage;
if storage is unavailable, download still works until the page closes.
Logs contain wrist coordinates/confidence, video and canvas dimensions, mode,
sample/processing timing, per-hand activation and every detector gate, plus
threshold settings. They contain no webcam images/video and are not uploaded.

Pose updates now consume each camera `currentTime` once, independently of the
display refresh rate. Speed uses elapsed camera time; repeated display frames
retain the hand indicator with a zero-length collision segment. A feed stalled
for over 150 ms clears tracking. Single-sample position jumps over 25% of video
height reset the stroke without creating a slicing segment. Debug capture logs
only processed camera samples, including `frameTime` and display `renderDt`.
The anonymized coordinate fixture reproduces the 120 Hz display / 30 Hz camera
failure and checks that recorded sweeps activate while the quiet tail does not.

## Opt-in motion simulation

Motion simulations and recorded-camera replays are intentionally separate from
`node --test tests/*.test.mjs`. Run them explicitly when changing motion logic:

```sh
node simulation/run.mjs
node --test simulation/*.test.mjs
```

The CLI runs straight back-and-forth motion, a continuous ellipse, slow movement,
and stationary noise through the real `PoseProcessor` and `SliceMotion`. Its
minimal DOM stub replaces only canvas creation. Defaults match the recording's
480 px video height, 30 Hz camera and 120 Hz display; trajectories and noise are
synthetic approximations, not an exact statistical fit of the recognition model.
Output reports percentage of red frames, activation transitions per minute,
longest uninterrupted red interval, processed camera samples, and red frames
on injected jumps. For `noise` and `slow`, activations are false positives; for
`line`, reactivation around direction changes is expected.

Noise parameters are explicit and reproducible:

| Flag | Default | Meaning |
| --- | --- | --- |
| `--noise-std` | 1.5 | Stationary Gaussian standard deviation in pixels per axis |
| `--noise-correlation` | 0.6 | Correlation between neighbouring camera samples, between -1 and 1 |
| `--seed` | 42 | Integer random seed |
| `--duration` | 30 | Simulated seconds per scenario, without waiting in real time |
| `--camera-fps` | 30 | New wrist measurements per second |
| `--display-fps` | 120 | Display updates per second, including repeated measurements |
| `--height` | 480 | Video height in pixels; noise remains in pixels when height changes |
| `--speed` | 0.6 | Straight-line speed in video heights per second |
| `--ellipse-period` | 3 | Seconds per ellipse; radii are 0.38 and 0.18 video heights |
| `--jump-rate` | 0 | Mean single-camera-frame recognition jumps per second |
| `--jump-size` | 0.6 | Jump distance in video heights, in a random direction |
| `--output` | none | Save parameters, metrics and complete coordinate/activation timeline as JSON |

```sh
node simulation/run.mjs --noise-std 3 --noise-correlation 0.6 --duration 120 --seed 7
node simulation/run.mjs --jump-rate 0.1 --jump-size 0.6
node simulation/run.mjs --noise-std 6 --output /tmp/motion-stress.json
```

The opt-in suite checks several random seeds and camera/display rates. With
normal jitter (1.5 px, correlation 0.6), moving paths must stay red over 85% of
the time, while stationary/slow paths allow at most 0.2% red frames and one false
activation per minute. At 3 px jitter the explicit stress budget is under 2% red
frames, at most 15 false activations per minute, and no red burst over 0.25 s.
These budgets are test bounds for the specified noise models, not guarantees for
arbitrarily strong noise. Increasing noise to 6 px can produce frequent false
positives; the CLI exposes that failure instead of silently loosening assertions.
