/** A rectangle in CSS pixels, origin at the top left of the canvas. */
export type Rect = { x: number; y: number; w: number; h: number };

/**
 * Where the set and the picture go when both are on screen: the set takes the
 * left half edge to edge, the picture is fitted to its format inside the right
 * half with a margin. Used by the renderer, the pointer and the overlays, so
 * all three agree to the pixel.
 */
export function splitLayout(width: number, height: number, aspect: number): { free: Rect; shot: Rect; divider: number } {
  const divider = Math.round(width * 0.5);
  const pad = 24;
  const aw = Math.max(1, width - divider - pad * 2);
  const ah = Math.max(1, height - pad * 2);
  let w = aw;
  let h = w / aspect;
  if (h > ah) {
    h = ah;
    w = h * aspect;
  }
  w = Math.max(1, Math.floor(w));
  h = Math.max(1, Math.floor(h));
  const shot = { x: divider + pad + Math.floor((aw - w) / 2), y: pad + Math.floor((ah - h) / 2), w, h };
  return { free: { x: 0, y: 0, w: divider, h: height }, shot, divider };
}
