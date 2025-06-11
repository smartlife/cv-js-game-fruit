export function orientation(p, q, r) {
  return (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
}

export function onSegment(p, q, r) {
  return Math.min(p.x, r.x) <= q.x && q.x <= Math.max(p.x, r.x) &&
         Math.min(p.y, r.y) <= q.y && q.y <= Math.max(p.y, r.y);
}

export function segmentsIntersect(a1, a2, b1, b2) {
  const o1 = orientation(a1, a2, b1);
  const o2 = orientation(a1, a2, b2);
  const o3 = orientation(b1, b2, a1);
  const o4 = orientation(b1, b2, a2);

  if (o1 * o2 < 0 && o3 * o4 < 0) return true;
  if (o1 === 0 && onSegment(a1, b1, a2)) return true;
  if (o2 === 0 && onSegment(a1, b2, a2)) return true;
  if (o3 === 0 && onSegment(b1, a1, b2)) return true;
  if (o4 === 0 && onSegment(b1, a2, b2)) return true;
  return false;
}

export function pointSegmentDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

export function segmentsClose(a1, a2, b1, b2, radius) {
  if (segmentsIntersect(a1, a2, b1, b2)) return true;
  const d1 = pointSegmentDistance(a1.x, a1.y, b1.x, b1.y, b2.x, b2.y);
  const d2 = pointSegmentDistance(a2.x, a2.y, b1.x, b1.y, b2.x, b2.y);
  const d3 = pointSegmentDistance(b1.x, b1.y, a1.x, a1.y, a2.x, a2.y);
  const d4 = pointSegmentDistance(b2.x, b2.y, a1.x, a1.y, a2.x, a2.y);
  const minDist = Math.min(d1, d2, d3, d4);
  return minDist <= radius;
}

export function pointInRect(p, rect) {
  return p.x >= rect.left && p.x <= rect.right && p.y >= rect.top && p.y <= rect.bottom;
}

export function segmentRectIntersect(p1, p2, rect, radius = 0) {
  if (pointInRect(p1, rect) || pointInRect(p2, rect)) return true;
  const corners = [
    { x: rect.left, y: rect.top },
    { x: rect.right, y: rect.top },
    { x: rect.right, y: rect.bottom },
    { x: rect.left, y: rect.bottom },
  ];
  for (let i = 0; i < 4; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % 4];
    if (segmentsClose(p1, p2, a, b, radius)) return true;
  }
  return false;
}
