export interface PageRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

/** Camera coordinates are in page-grid units; padding stays constant on screen. */
export function constrainPageCamera(
  x: number,
  y: number,
  zoom: number,
  viewport: { width: number; height: number },
  pages: PageRect[],
) {
  if (!pages.length || viewport.width <= 0 || viewport.height <= 0)
    return { x, y };
  const width = viewport.width / zoom;
  const height = viewport.height / zoom;
  const padding = Math.min(32, viewport.width / 8, viewport.height / 8) / zoom;
  const left = Math.min(...pages.map((p) => p.x));
  const right = Math.max(...pages.map((p) => p.x + p.width));
  const top = Math.min(...pages.map((p) => p.y));
  const bottom = Math.max(...pages.map((p) => p.y + p.height));
  const axis = (value: number, start: number, end: number, size: number) =>
    end - start + padding * 2 <= size
      ? (start + end - size) / 2
      : clamp(value, start - padding, end + padding - size);
  x = axis(x, left, right, width);
  y = axis(y, top, bottom, height);

  // A partial final row can leave an empty corner inside the overall bounds.
  // Keep a useful portion of the nearest page in view, even at maximum zoom.
  let closest = { x, y };
  let distance = Infinity;
  for (const page of pages) {
    const visibleX = Math.min(48 / zoom, page.width / 2, width / 4);
    const visibleY = Math.min(48 / zoom, page.height / 2, height / 4);
    const nextX = clamp(
      x,
      page.x + visibleX - width,
      page.x + page.width - visibleX,
    );
    const nextY = clamp(
      y,
      page.y + visibleY - height,
      page.y + page.height - visibleY,
    );
    const d = (nextX - x) ** 2 + (nextY - y) ** 2;
    if (d < distance) {
      closest = { x: nextX, y: nextY };
      distance = d;
    }
    if (d === 0) break;
  }
  return closest;
}
