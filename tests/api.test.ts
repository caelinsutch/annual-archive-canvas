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
