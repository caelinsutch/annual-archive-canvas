import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { Report, ReportManifest } from "../src/lib/types";
const catalog: Report[] = JSON.parse(
  readFileSync("public/catalog.json", "utf8"),
);
test("Columbia bound volumes expose only the verified year, including both covers", () => {
  const ranges = [
    [1954, 0, 15],
    [1955, 16, 31],
    [1956, 32, 47],
    [1957, 48, 63],
    [1958, 64, 83],
  ];
  for (const [year, start, end] of ranges) {
    const report = catalog.find(
      (r) => r.id === `columbia-new-york-airways-${year}`,
    )!;
    assert.ok(report);
    assert.equal(report.y, String(year));
    const manifest: ReportManifest = JSON.parse(
      readFileSync(`public/source-manifests/${report.id}.json`, "utf8"),
    );
    assert.equal(manifest.pages.length, end - start + 1);
    manifest.pages.forEach((page, index) => {
      assert.equal(page.index, index);
      assert.equal(page.leaf, start + index);
      assert.ok(page.width > 100 && page.height > 100);
    });
    const cover = readFileSync("public/" + report.img);
    assert.equal(cover[0], 0xff);
    assert.equal(cover[1], 0xd8);
  }
});
test("every catalogue record has a matching text embedding in catalogue order", () => {
  const manifest = JSON.parse(
    readFileSync("public/search/manifest.json", "utf8"),
  );
  assert.deepEqual(
    manifest.ids,
    catalog.map((r) => r.id),
  );
  assert.equal(
    readFileSync("public/search/vectors.bin").length,
    catalog.length * manifest.dimensions * 4,
  );
});
