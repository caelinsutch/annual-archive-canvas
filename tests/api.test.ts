import test from "node:test";
import assert from "node:assert/strict";
const base = process.env.TEST_URL;
const options = { skip: !base };
test(
  "API rejects unknown reports and arbitrary source URLs",
  options,
  async () => {
    for (const path of [
      "/api/report?id=missing",
      "/api/pdf?id=https://example.com/private.pdf",
      "/api/page?id=../../etc/passwd",
    ])
      assert.equal((await fetch(base + path)).status, 404);
  },
);
test("UW download metadata resolves into a PDF reader", options, async () => {
  const result = await (await fetch(base + "/api/report?id=uw43767")).json();
  assert.equal(result.kind, "pdf");
  assert.match(
    result.pdf,
    /\/digital\/api\/collection\/reports\/id\/43767\/download/,
  );
});
test(
  "actual scan dimensions, pages and design tags reach the reader",
  options,
  async () => {
    const result = await (
      await fetch(base + "/api/report?id=paulrand-cummins-1966")
    ).json();
    assert.equal(result.pages.length, 24);
    assert.ok(
      result.pages.every(
        (p: { width: number; height: number }) => p.width > 0 && p.height > 0,
      ),
    );
    assert.ok(
      result.design[3].some(
        (tag: { label: string }) => tag.label === "financial table",
      ),
    );
  },
);
test("gibberish has an empty semantic result set", options, async () => {
  const result = await (
    await fetch(base + "/api/search?q=zxqv999%20nonsensezz")
  ).json();
  assert.deepEqual(result.hits, []);
});
test(
  "page-role search retrieves the independently labeled financial table",
  options,
  async () => {
    const result = await (
      await fetch(
        base +
          "/api/page-search?q=financial%20table&reportId=paulrand-cummins-1966",
      )
    ).json();
    assert.equal(result.hits[0].pageIndex, 3);
    assert.equal(result.hits[0].reportId, "paulrand-cummins-1966");
  },
);

test(
  "home page catalogue contains unique, routable scans without embedding payloads",
  options,
  async () => {
    const response = await fetch(base + "/api/pages");
    assert.equal(response.status, 200);
    const result = await response.json();
    const pages = result.pages as {
      reportId: string;
      pageIndex: number;
      image: string;
    }[];
    assert.ok(pages.length > 2500);
    assert.equal(
      new Set(pages.map((p) => `${p.reportId}:${p.pageIndex}`)).size,
      pages.length,
    );
    assert.ok(
      pages.every(
        (p) =>
          Number.isInteger(p.pageIndex) &&
          p.pageIndex >= 0 &&
          /^(\/api\/page\?|\/search\/)/.test(p.image),
      ),
    );
    assert.equal(result.vectors, undefined);
    const cummins = await (
      await fetch(base + "/api/report?id=paulrand-cummins-1966")
    ).json();
    assert.equal(
      pages.filter((p) => p.reportId === "paulrand-cummins-1966").length,
      cummins.pages.length,
    );
  },
);

test(
  "corrected issuer names are discoverable in semantic search",
  options,
  async () => {
    const response = await fetch(
      base + "/api/search?q=" + encodeURIComponent("O'Brien Gold Mines"),
    );
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.ok(
      result.hits
        .slice(0, 5)
        .some((hit: { id: string }) =>
          [
            "McGillLibrary-640204-44432",
            "McGillLibrary-640202-44426",
            "McGillLibrary-640200-44420",
          ].includes(hit.id),
        ),
    );
  },
);
