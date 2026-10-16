# Strawberry boost visualization

The user requested static strawberry decorations along the left and right screen
edges when strawberry mode activates. Each berry has a random fixed rotation,
vertical position, and center offset between -0.3 and +0.3 of its width from the
edge. The count represents the expected additional fruit budget from the level's
normal spawn rate, boost duration, and multiplier, rather than a fixed ten berries.
The count decreases in proportion to remaining boost time. Remove the topmost
berries first so overlapping decorations visibly change.

The user approved committing, merging to main, and pushing to the remote main.
The existing random gameplay spawn distribution is preserved. README.md describes
the visualization and its expected-budget interpretation.
