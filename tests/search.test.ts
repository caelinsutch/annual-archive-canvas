import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { rank, lexicalScore, normalize } from "../src/search/rank";
import { matchesFilters, SearchGeneration } from "../src/search/control";
import { taxonomy, prompts, classify } from "../src/search/taxonomy";
import type { Report } from "../src/lib/types";
const report = (id: string, extra: Partial<Report> = {}): Report => ({
  id,
  o: id,
  y: "1966",
  i: "manufacturing",
  k: "blue",
  c: "test",
  s: "https://example.com",
  img: "cover.jpg",
  a: 1.3,
  ...extra,
});
test("lexical matching ignores case and accents", () =>
  assert.equal(normalize("GÉOMÉTRIC"), "geometric"));
test("exact company/year matches receive full lexical credit", () => {
  assert.equal(lexicalScore("Cummins", report("Cummins")), 1);
  assert.equal(lexicalScore("1966", report("Cummins")), 1);
});
test("designer and visual description are searchable", () => {
  const r = report("Cummins", {
    dsg: "Paul Rand",
    d: "Geometric circles on cream",
  });
  assert.ok(lexicalScore("Paul Rand", r) > 0);
  assert.ok(lexicalScore("geometric", r) > 0);
});
test("empty query has no accidental lexical score", () =>
  assert.equal(lexicalScore("", report("abc")), 0));
test("semantic similarity retrieves synonyms without a lexical match", () => {
  const hits = rank(
    "warm shapes",
    new Float32Array([1, 0]),
    [report("a"), report("b")],
    new Float32Array([0, 1, 1, 0]),
    2,
  );
  assert.equal(hits[0].id, "b");
});
test("exact names resist unrelated semantic matches", () => {
  const hits = rank(
    "Cummins",
    new Float32Array([1, 0]),
    [report("Cummins"), report("Other")],
    new Float32Array([0, 1, 1, 0]),
    2,
  );
  assert.equal(hits[0].id, "Cummins");
});
test("dimension mismatch and invalid queries fail explicitly", () => {
  assert.throws(() =>
    rank("x", new Float32Array(2), [report("a")], new Float32Array(3), 2),
  );
  assert.throws(() =>
    rank("x", new Float32Array([NaN, 0]), [], new Float32Array(), 2),
  );
});
test("filters intersect decade, color, industry and collection", () => {
  const r = report("a");
  assert.ok(
    matchesFilters(r, {
      decade: "1960",
      color: "blue",
      industry: "manufacturing",
      savedOnly: true,
      saved: new Set(["a"]),
    }),
  );
  for (const filter of [
    { decade: "1970" },
    { color: "red" },
    { industry: "banking" },
    { savedOnly: true, saved: new Set<string>() },
  ])
    assert.equal(matchesFilters(r, filter), false);
});
test("stale search cannot repaint after a later request or reset", () => {
  const state = new SearchGeneration();
  const first = state.next();
  const second = state.next();
  assert.equal(state.isCurrent(first), false);
  assert.equal(state.isCurrent(second), true);
  state.next();
  assert.equal(state.isCurrent(second), false);
});
test("catalogue embedding index is complete, normalized, finite and aligned", async () => {
  const catalog: Report[] = JSON.parse(
    await readFile("public/catalog.json", "utf8"),
  );
  const meta = JSON.parse(
    await readFile("public/search/manifest.json", "utf8"),
  );
  const b = await readFile("public/search/vectors.bin");
  const vectors = new Float32Array(
    b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
  );
  assert.deepEqual(
    meta.ids,
    catalog.map((r) => r.id),
  );
  assert.equal(vectors.length, catalog.length * meta.dimensions);
  for (let start = 0; start < vectors.length; start += meta.dimensions) {
    let norm = 0;
    for (let d = 0; d < meta.dimensions; d++) {
      assert.ok(Number.isFinite(vectors[start + d]));
      norm += vectors[start + d] ** 2;
    }
    assert.ok(Math.abs(norm - 1) < 0.01);
  }
});
test("visual taxonomy covers roles, layouts, typography, imagery, palette and style", () =>
  assert.deepEqual(Object.keys(taxonomy), [
    "role",
    "layout",
    "typography",
    "imagery",
    "color",
    "style",
  ]));
test("visual tags preserve model provenance and avoid low-similarity labels", () => {
  const labels = new Float32Array(prompts.length * 2);
  const at = prompts.findIndex((p) => p.label === "financial table");
  labels[at * 2] = 1;
  const tags = classify(new Float32Array([1, 0]), labels);
  assert.equal(tags.length, 1);
  assert.equal(tags[0].label, "financial table");
  assert.equal(tags[0].provenance, "visual-model");
});
