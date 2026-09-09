import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { archiveIdentity, scanPages } from "../src/lib/report-api.ts";
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
  const d: import("../src/lib/types").Report[] = JSON.parse(
    fs.readFileSync("public/catalog.json", "utf8"),
  );
  assert.ok(d.length >= 3002);
  assert.equal(new Set(d.map((e) => e.id)).size, d.length);
  for (const e of d) {
    assert.equal(new URL(e.s).protocol, "https:");
    assert.match(e.img, /^covers\/[a-zA-Z0-9_.-]+\.jpg$/);
  }
});

test("PDF-only Internet Archive reports open inline when scan derivatives are absent", async (t) => {
  const { resolveReport } = await import("../src/lib/report-api");
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({ files: [{ name: "report1972.pdf" }] }),
  );
  const report = {
    id: "sample",
    s: "https://archive.org/details/collection/report1972",
    o: "Example",
    y: "1972",
    c: "Archive",
    i: "Other",
    k: "blue",
    img: "cover.jpg",
    a: 1.3,
  };
  const result = await resolveReport(report);
  assert.equal(result.kind, "pdf");
  assert.equal(
    result.pdf,
    "https://archive.org/download/collection/report1972.pdf",
  );
});

test("prefers the original PDF when the scan derivative contains only a cover", async (t) => {
  const { resolveReport } = await import("../src/lib/report-api");
  t.mock.method(globalThis, "fetch", async (url: string) =>
    url.includes("/metadata/")
      ? Response.json({
          d1: "archive.org",
          dir: "/items/sample",
          files: [
            { name: "report.pdf" },
            { name: "report_jp2.zip" },
            { name: "report_scandata.xml" },
          ],
        })
      : new Response(
          '<book><pageData><page leafNum="0"><origWidth>100</origWidth></page></pageData></book>',
        ),
  );
  const result = await resolveReport({
    id: "sample",
    s: "https://archive.org/details/sample/report",
    o: "Example",
    y: "1972",
    c: "Archive",
    i: "Other",
    k: "blue",
    img: "cover.jpg",
    a: 1.3,
  });
  assert.equal(result.kind, "pdf");
  assert.equal(result.pdf, "https://archive.org/download/sample/report.pdf");
});
