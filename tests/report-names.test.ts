import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { documentText } from "../src/search/rank";
import type { Report } from "../src/lib/types";
const catalogue: Report[] = JSON.parse(
  await readFile("public/catalog.json", "utf8"),
);
const names = new Map(catalogue.map((report) => [report.id, report.o]));
test("placeholder and collection-level headings are replaced with issuer names", () => {
  for (const report of catalogue) {
    assert.ok(report.o.trim(), report.id);
    assert.equal(report.o, report.o.normalize("NFC"), report.id);
    assert.doesNotMatch(
      report.o,
      /^\[Corporate reports\]$|^Miscellaneous$|Report to stockholders|Inc\.19\d\d/i,
      report.id,
    );
  }
  assert.equal(
    names.get("McGillLibrary-640204-44432"),
    "O'Brien Gold Mines Limited",
  );
  assert.equal(
    names.get("McGillLibrary-640202-44426"),
    "O'Brien Gold Mines Limited",
  );
  assert.equal(
    names.get("McGillLibrary-640200-44420"),
    "O'Brien Gold Mines Limited",
  );
});
test("historical issuers are distinguished from successors and subsidiary logos", () => {
  assert.equal(
    names.get("daytonhudsontargetannualreports__dayton1967"),
    "Dayton Corporation",
  );
  assert.equal(
    names.get("pepsicofritolayannualreports__pepsico1966"),
    "PepsiCo",
  );
  assert.equal(
    names.get("pepsicofritolayannualreports__frito1958"),
    "The Frito Company",
  );
  assert.equal(names.get("walgreensWBAannualreports__boots1987"), "Boots");
  assert.equal(
    names.get(
      "nationaldairykraftcounitedrexalldrugdartannualreports__nationaldairy1954",
    ),
    "National Dairy Products Corporation",
  );
});
test("search embeddings use the current corrected report names", async () => {
  const manifest = JSON.parse(
    await readFile("public/search/manifest.json", "utf8"),
  );
  assert.equal(manifest.ids.length, catalogue.length);
  for (let index = 0; index < catalogue.length; index++) {
    assert.equal(manifest.ids[index], catalogue[index].id);
    assert.equal(
      manifest.texts[index],
      documentText(catalogue[index]),
      catalogue[index].id,
    );
  }
});
