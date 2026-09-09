import test from "node:test";
import assert from "node:assert/strict";
import {
  contentDmIdentity,
  iiifPages,
  paulRandImages,
  resolveExternalReport,
  webpDimensions,
} from "../src/lib/source-adapters";
import type { Report } from "../src/lib/types";
const report = (s: string): Report => ({
  id: "sample",
  o: "Cummins",
  y: "1966",
  c: "",
  s,
  i: "",
  k: "",
  img: "",
  a: 1,
});
const jsonFetch =
  (routes: Record<string, unknown>): typeof fetch =>
  async (input) => {
    const url = String(input);
    assert.ok(url in routes, `Unexpected request: ${url}`);
    return new Response(JSON.stringify(routes[url]), {
      headers: { "Content-Type": "application/json" },
    });
  };

test("UW PDF metadata wins over the single cover exposed by IIIF", async () => {
  const s =
    "https://digitalcollections.lib.washington.edu/digital/collection/reports/id/43767";
  const result = await resolveExternalReport(
    report(s),
    jsonFetch({
      "https://digitalcollections.lib.washington.edu/digital/api/singleitem/collection/reports/id/43767":
        {
          contentType: "application/pdf",
          filename: "49277.pdf",
          downloadUri: "/api/collection/reports/id/43767/download",
          objectInfo: { code: "-2" },
        },
    }),
  );
  assert.equal(result?.kind, "pdf");
  assert.equal(
    result?.pdf,
    "https://digitalcollections.lib.washington.edu/digital/api/collection/reports/id/43767/download",
  );
  assert.equal(result?.source, s);
});

test("UW compound report follows its published PDF child pointer", async () => {
  const root = "https://digitalcollections.lib.washington.edu/digital";
  const result = await resolveExternalReport(
    report(`${root}/collection/reports/id/2290`),
    jsonFetch({
      [`${root}/api/singleitem/collection/reports/id/2290`]: {
        filename: "2291.cpd",
        objectInfo: { page: { pagefile: "2269.pdf", pageptr: "2268" } },
      },
      [`${root}/api/singleitem/collection/reports/id/2268`]: {
        contentType: "application/pdf",
        downloadUri: "/api/collection/reports/id/2268/download",
      },
    }),
  );
  assert.equal(result?.pdf, `${root}/api/collection/reports/id/2268/download`);
});

test("IIIF v2 preserves spread dimensions and actual resource IDs", () => {
  const pages = iiifPages(
    {
      sequences: [
        {
          canvases: [
            {
              label: "Spread",
              width: 2400,
              height: 1200,
              images: [
                {
                  resource: {
                    "@id": "https://example.org/actual.jpg",
                    service: { "@id": "https://example.org/iiif/42" },
                  },
                },
              ],
            },
          ],
        },
      ],
    },
    "https://example.org",
  );
  assert.equal(pages[0].width / pages[0].height, 2);
  assert.equal(pages[0].image, "https://example.org/actual.jpg");
  assert.equal(
    pages[0].thumb,
    "https://example.org/iiif/42/full/!450,600/0/default.jpg",
  );
});

test("IIIF v3 parses language labels and ignores malformed pages", () => {
  const pages = iiifPages(
    {
      items: [
        {
          label: { en: ["Cover"] },
          width: 100,
          height: 150,
          items: [
            { items: [{ body: { id: "https://example.org/page.jpg" } }] },
          ],
        },
        { width: 0, height: 0 },
      ],
    },
    "https://example.org",
  );
  assert.equal(pages.length, 1);
  assert.equal(pages[0].label, "Cover");
});

test("Paul Rand gallery selects report/year links, deduplicates and excludes adjacent projects", () => {
  const url =
    "https://assets.paulrand.design/Works/Cummins/Annual%20Reports/1966/Web/Cummins%2001.webp";
  assert.deepEqual(
    paulRandImages(
      `<a href="${url}"><a href="${url}"><a href="${url.replace("1966", "1967")}"><a href="${url.replace("Annual%20Reports", "Logo")}">`,
      report("https://paulrand.design/work/Cummins.html"),
    ),
    [url],
  );
});

test("WebP header dimensions preserve landscape and portrait images", () => {
  const header = new Uint8Array(30);
  const put = (start: number, s: string) =>
    [...s].forEach((c, i) => (header[start + i] = c.charCodeAt(0)));
  put(0, "RIFF");
  put(8, "WEBP");
  put(12, "VP8X");
  header[24] = 255;
  header[25] = 7;
  header[27] = 255;
  header[28] = 3;
  assert.deepEqual(webpDimensions(header), { width: 2048, height: 1024 });
  assert.equal(webpDimensions(new Uint8Array(2)), null);
});

test("unknown source stays external without inventing document URLs", async () => {
  assert.equal(
    await resolveExternalReport(
      report("https://archives.sva.edu/Detail/objects/10169"),
    ),
    null,
  );
  assert.equal(
    contentDmIdentity(
      "https://example.org/digital/collection/reports/id/43767",
    ),
    null,
  );
});

test("visually verified IBM1979 full report replaces the single gallery cover", async () => {
  const r = {
    ...report("https://paulrand.design/work/IBM.html#annualReports"),
    id: "paulrand-ibm-1979",
    y: "1979",
  };
  const m = await resolveExternalReport(r, jsonFetch({}));
  assert.equal(m?.kind, "pdf");
  assert.equal(
    m?.pdf,
    "https://public-content.library.mcgill.ca/digitization/634063.pdf",
  );
  assert.equal(m?.source, r.s);
});

test("IBM1985 uses the verified52-page McGill original", async () => {
  const r = {
    ...report("https://paulrand.design/work/IBM.html#annualReports"),
    id: "paulrand-ibm-1985",
    y: "1985",
  };
  const m = await resolveExternalReport(r, jsonFetch({}));
  assert.equal(m?.kind, "pdf");
  assert.equal(
    m?.pdf,
    "https://public-content.library.mcgill.ca/digitization/634061.pdf",
  );
});

for (const [year, file] of [
  ["1980", "634062"],
  ["1986", "634060"],
  ["1989", "634059"],
]) {
  test(`IBM${year} resolves its exact verified full original`, async () => {
    const r = {
      ...report("https://paulrand.design/work/IBM.html#annualReports"),
      id: `paulrand-ibm-${year}`,
      y: year,
    };
    const m = await resolveExternalReport(r, jsonFetch({}));
    assert.equal(m?.kind, "pdf");
    assert.equal(
      m?.pdf,
      `https://public-content.library.mcgill.ca/digitization/${file}.pdf`,
    );
  });
}
