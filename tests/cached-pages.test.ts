import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat, readdir } from "node:fs/promises";
import sharp from "sharp";
import type { ReportManifest } from "../src/lib/types";

test("downloaded reports retain complete, dimensioned, readable local pages", async () => {
  const indexed = new Set(
    JSON.parse(await readFile("public/search/pages/metadata.json", "utf8")).map(
      (page: { id: string }) => page.id,
    ),
  );
  let checked = 0;
  for (const file of await readdir("public/source-manifests")) {
    const manifest = JSON.parse(
      await readFile("public/source-manifests/" + file, "utf8"),
    ) as ReportManifest & {
      download?: { pageCount: number; sha256: string; url: string };
    };
    if (!manifest.download) continue;
    checked++;
    assert.equal(manifest.kind, "scans");
    assert.equal(manifest.pages.length, manifest.download.pageCount, file);
    assert.equal(manifest.pdf, manifest.download.url);
    assert.match(manifest.download.sha256, /^[a-f0-9]{64}$/);
    for (const [i, page] of manifest.pages.entries()) {
      assert.equal(page.index, i);
      assert.ok(
        indexed.has(`${file.slice(0, -5)}--${i}`),
        `Missing embedding for ${file}:${i}`,
      );
      assert.ok(page.width > 0 && page.height > 0);
      for (const path of [page.thumb, page.image]) {
        assert.match(
          path,
          /^\/report-pages\/[a-zA-Z0-9_-]+\/\d+(?:-thumb)?\.jpg$/,
        );
        assert.ok((await stat("public" + path)).size > 100);
      }
    }
    for (const page of [manifest.pages[0], manifest.pages.at(-1)!]) {
      const image = await sharp("public" + page.image).metadata();
      assert.equal(image.width, page.width);
      assert.equal(image.height, page.height);
      const thumb = await sharp("public" + page.thumb).metadata();
      assert.ok(Math.max(thumb.width!, thumb.height!) <= 600);
    }
  }
  assert.ok(checked > 0);
});
