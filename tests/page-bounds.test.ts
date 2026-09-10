import test from "node:test";
import assert from "node:assert/strict";
import { constrainPageCamera, type PageRect } from "../src/lib/page-bounds";
const pages: PageRect[] = Array.from({ length: 27 }, (_, i) => ({
  x: (i % 5) * 270 + 40,
  y: Math.floor(i / 5) * 380,
  width: 210,
  height: 300,
}));

test("all edges are bounded at every supported zoom and viewport size", () => {
  for (const zoom of [0.45, 1, 2])
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 390, height: 700 },
      { width: 720, height: 300 },
    ]) {
      for (const x of [-1e6, 0, 1e6])
        for (const y of [-1e6, 0, 1e6]) {
          const c = constrainPageCamera(x, y, zoom, viewport, pages);
          assert.ok(
            pages.some(
              (p) =>
                Math.min(p.x + p.width, c.x + viewport.width / zoom) -
                  Math.max(p.x, c.x) >
                  0 &&
                Math.min(p.y + p.height, c.y + viewport.height / zoom) -
                  Math.max(p.y, c.y) >
                  0,
            ),
          );
          assert.deepEqual(
            constrainPageCamera(c.x, c.y, zoom, viewport, pages),
            c,
            "clamping must settle without oscillation",
          );
        }
    }
});
test("small reports stay centered instead of drifting offscreen", () => {
  const viewport = { width: 1000, height: 800 };
  const c = constrainPageCamera(1e6, -1e6, 1, viewport, [pages[0]]);
  assert.deepEqual(c, { x: 145 - 500, y: 150 - 400 });
});
test("opposite input responds immediately after reaching an edge", () => {
  const viewport = { width: 800, height: 700 };
  const c = constrainPageCamera(1e6, 0, 1, viewport, pages);
  assert.equal(
    constrainPageCamera(c.x - 20, c.y, 1, viewport, pages).x,
    c.x - 20,
  );
});
test("partial final rows cannot leave the camera in an empty corner", () => {
  const c = constrainPageCamera(
    1e6,
    1e6,
    2,
    { width: 390, height: 500 },
    pages,
  );
  assert.ok(
    pages.some(
      (p) =>
        p.x < c.x + 195 &&
        p.x + p.width > c.x &&
        p.y < c.y + 250 &&
        p.y + p.height > c.y,
    ),
  );
});
test("empty or hidden canvases retain their camera until layout is measurable", () => {
  assert.deepEqual(
    constrainPageCamera(4, 8, 1, { width: 0, height: 0 }, pages),
    { x: 4, y: 8 },
  );
  assert.deepEqual(
    constrainPageCamera(4, 8, 1, { width: 800, height: 600 }, []),
    { x: 4, y: 8 },
  );
});
