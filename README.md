# cv-js-game-fruit

Browser webcam game for catching fruits.

This repository now contains the initial structure of a pose‑controlled fruit cutting game. The game runs entirely in the browser and relies on the webcam to track the player's palms.

## Overview

- **index.html** – loads external pose detection libraries and switches between different game modes.
- **js/poseProcessor.js** – wrapper around pose detection library. Initializes the webcam stream and pose detector once and draws highlighted palms.
- **js/config.js** – global configuration with a `DEBUG` flag, `USE_STUB` to simulate movement without a webcam and `ACTIVE_SPEED_FRACTION` controlling how fast a hand must move to become active.
- **js/fruitConfig.js** – list of available fruits with image, score and size information.
- **js/levelConfig.js** – game levels defining speed, duration, spawn rate and prioritized fruit choices.
- **js/modeManager.js** – simple controller used to register and switch between modes.
- **js/startMode.js** – displays the intro screen with live webcam feed. Cutting the start button with a fast hand movement begins the game.
- **js/fruit.js** – small physics object representing a falling fruit.
- **js/gameMode.js** – real‑time game loop that updates the timer, fruits and palm positions every frame.
- **img/** – folder with fruit images. The `basic` entry in `js/fruitConfig.js`
  provides the image used for the start button.

The code is written in small modules so that additional modes (for example a score screen or settings) can be added later by registering new mode classes with `ModeManager`.

## Running

Serve the repository over HTTP and open `index.html` in a modern browser. For example you can run `npx serve` from the project root. The page will request webcam permissions and show the start screen. Fast palm movements are detected using pose estimation. Slice through the start button with a quick hand motion to begin. Each level defines its own duration and how many fruits appear per second. During the round fruits spawn from the sides of the screen following a Poisson distribution and fall with gravity. Cutting them by moving your hand quickly across a fruit awards score.

The game scales all visuals according to the height of the video feed. The feed is cropped to a 4:3 ratio and displayed full-screen with black borders if necessary. If you set `USE_STUB` to `true` in `js/config.js`, the game will generate mock hand motion so you can test without a webcam. Enable `DEBUG` for verbose console logging from all modules.
If the MoveNet model fails to load because of CORS restrictions, download the model files locally and update the paths in `js/poseProcessor.js`.

Edit `js/levelConfig.js` to tweak the game speed, duration, spawn rate or change which fruits appear in each level. The webcam stream and pose detector are kept alive across modes so they only need to initialize once.

