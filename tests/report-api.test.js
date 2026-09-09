import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { archiveIdentity, scanPages } from "../src/report-api.js";
test("resolves individual reports and reports nested in collections", () => {
  assert.deepEqual(archiveIdentity("https://archive.org/details/a/b"), {
    item: "a",
    book: "b",
  });
  assert.deepEqual(archiveIdentity("https://archive.org/details/a"), {
    item: "a",
    book: undefined,
  });
  assert.equal(archiveIdentity("https://example.com/details/a"), null);
});
test("uses source leaf numbers and excludes inaccessible leaves", () => {
  const xml =
    '<book><pageData><page leafNum="2"><addToAccessFormats>true</addToAccessFormats><pageNumber>iii</pageNumber><cropBox><w>1000</w><h>1500</h></cropBox></page><page leafNum="3"><addToAccessFormats>false</addToAccessFormats></page><page leafNum="4"><origWidth>900</origWidth><origHeight>1400</origHeight></page></pageData></book>';
  const p = scanPages(xml, {
    server: "ia800000.us.archive.org",
    dir: "/1/items/a",
    zip: "book_jp2.zip",
  });
  assert.equal(p.length, 2);
  assert.equal(p[0].label, "iii");
  assert.equal(p[1].index, 1);
  assert.equal(p[1].leaf, 4);
  assert.equal(p[0].height, 1500);
  assert.match(p[1].thumb, /book_0004.jp2/);
  assert.match(p[1].image, /scale=1/);
});
test("handles a single-page report", () => {
  assert.equal(
    scanPages(
      '<book><pageData><page leafNum="0"><origWidth>100</origWidth></page></pageData></book>',
      { server: "a", dir: "/a", zip: "a_jp2.zip" },
    ).length,
    1,
  );
});
test("catalogue retains unique records and valid source and cover paths", () => {
  const d = JSON.parse(fs.readFileSync("public/catalog.json"));
  assert.equal(d.length, 3002);
  assert.equal(new Set(d.map((e) => e.id)).size, d.length);
  for (const e of d) {
    assert.equal(new URL(e.s).protocol, "https:");
    assert.match(e.img, /^covers\/[a-zA-Z0-9_.-]+\.jpg$/);
  }
});
