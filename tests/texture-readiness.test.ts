import test from "node:test";
import assert from "node:assert/strict";
import {
  textureTarget,
  waitForTextureCoverage,
} from "../src/client/texture-readiness";

test("small viewports require every texture; larger viewports require at least 85%", () => {
  assert.equal(textureTarget(5), 5);
  assert.equal(textureTarget(12), 12);
  assert.equal(textureTarget(20), 17);
  assert.equal(textureTarget(40), 34);
});
test("decoded DOM images do not release the gate before textures arrive", async () => {
  let time = 0;
  const result = await waitForTextureCoverage(
    () => ({ ready: time < 3 ? 4 : 17, total: 20 }),
    async () => {
      time++;
    },
    () => time,
  );
  assert.equal(time, 3);
  assert.equal(result.complete, true);
});
test("a permanently unavailable texture set uses a bounded fallback", async () => {
  let time = 0;
  const result = await waitForTextureCoverage(
    () => ({ ready: 3, total: 8 }),
    async () => {
      time++;
    },
    () => time,
    5,
  );
  assert.equal(time, 5);
  assert.equal(result.complete, false);
});
test("an empty first frame waits for canvas cards to exist", async () => {
  let time = 0;
  const result = await waitForTextureCoverage(
    () => (time < 2 ? { ready: 0, total: 0 } : { ready: 6, total: 6 }),
    async () => {
      time++;
    },
    () => time,
  );
  assert.equal(time, 2);
  assert.equal(result.complete, true);
});
