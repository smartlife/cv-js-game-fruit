# User request: blade movement animation

Replace red hand circles throughout the game with a stylish cold blue/white
comic-like blade or comet trail. Keep roughly 300 ms of motion, tapering and
fading toward the tail. Hide stationary white hand circles. Apply the same
artwork on every screen. The tail is visual only; preserve existing front
movement collision behavior.

Implemented in the shared PoseProcessor foreground renderer, with independent
per-hand histories cleared on mode reset and canvas resize. Only confirmed
moving hands extend the trail; all other frames let it expire in real time.
