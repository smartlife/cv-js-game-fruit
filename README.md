# cv-js-game-fruit

Browser webcam game for catching fruits.

This repository now contains the initial structure of a pose‑controlled fruit cutting game. The game runs entirely in the browser and relies on the webcam to track the player's palms.

## Overview

- **index.html** – loads external pose detection libraries and switches between different game modes.
- **js/poseProcessor.js** – wrapper around pose detection library. Starts the webcam, estimates body pose and draws highlighted palms with speed information.
- **js/config.js** – global configuration with a `DEBUG` flag and `USE_STUB` to simulate movement without a webcam.
- **js/modeManager.js** – simple controller used to register and switch between modes.
- **js/startMode.js** – displays the intro screen with live webcam feed. Cutting the start button with a fast hand movement begins the game.
- **js/fruit.js** – small physics object representing a falling fruit.
- **js/gameMode.js** – real‑time game loop that updates the timer, fruits and palm positions every frame.
 - **fruit.png** – image used for spawned fruits (not included; place your own file at the project root).

The code is written in small modules so that additional modes (for example a score screen or settings) can be added later by registering new mode classes with `ModeManager`.

## Running

Open `index.html` in a modern browser. It will request webcam permissions and show the start screen. Fast palm movements are detected using pose estimation. Slice through the start button with a quick hand motion to begin. During the 60 second round, fruits spawn from the sides of the screen and fall with gravity. Cutting them by moving your hand quickly across a fruit awards score.

The game scales all visuals according to the height of the video feed. The feed is cropped to a 4:3 ratio and displayed full-screen with black borders if necessary. If you set `USE_STUB` to `true` in `js/config.js`, the game will generate mock hand motion so you can test without a webcam. Enable `DEBUG` for verbose console logging from all modules.
