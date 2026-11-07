# User request: reduce perceived blade lag

Shorten the trail lifetime by 20%, make its front substantially thicker, and
extend it a little forward from recent motion. Smooth the direction and limit
prediction to prevent tracking noise or forward/backward wobble.

Use 240 ms rather than 300 ms, widen the leading ribbon by up to 80%, and
project a small visual tip from up to three weighted recent measured segments.
Cap the lead, attenuate it for incoherent directions, and stop smoothing across
stroke boundaries, stale samples, and sharp reversals. Keep real hand samples
and collision behavior unchanged. Applies through the shared renderer.

Follow-up requirement: explicitly cap forward projection in absolute pixels,
never exceeding the former hand circle size. Use a hard 12 canvas-pixel ceiling
and the former circle radius (3% of video height), retaining the tighter existing
limits. This remains a visual-only offset.
