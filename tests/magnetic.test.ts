import test from "node:test";
import assert from "node:assert/strict";
import { magneticOffset } from "../src/lib/magnetic";
const rect = { left: 0, top: 0, width: 100, height: 40 };
test("magnetic response remains centered under the cursor at button center", () =>
  assert.deepEqual(magneticOffset(50, 20, rect), { x: 0, y: 0, strength: 1 }));
test("proximity smoothly falls off and disappears outside the activation radius", () => {
  assert.ok(
    magneticOffset(110, 20, rect).strength >
      magneticOffset(140, 20, rect).strength,
  );
  assert.deepEqual(magneticOffset(200, 20, rect), { x: 0, y: 0, strength: 0 });
});
test("magnetic displacement is bounded and symmetric", () => {
  const left = magneticOffset(-5, 20, rect),
    right = magneticOffset(105, 20, rect);
  assert.equal(left.x, -right.x);
  for (let x = -100; x < 200; x += 5)
    for (let y = -100; y < 140; y += 5) {
      const result = magneticOffset(x, y, rect);
      assert.ok(Math.abs(result.x) <= 2.5 && Math.abs(result.y) <= 2.5);
      assert.ok(result.strength >= 0 && result.strength <= 1);
    }
});
