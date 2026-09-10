import { readFile, writeFile } from "node:fs/promises";
import { embedVisualText, VISUAL_DIMENSIONS } from "../src/search/visual";
import { dot, type IndexedPage } from "../src/search/taxonomy";
const fixtures = JSON.parse(
  await readFile("benchmarks/page-expansion-cases.json", "utf8"),
) as {
  scope: string;
  cases: { reportId: string; pageIndex: number; query: string }[];
};
const index = JSON.parse(
  await readFile("public/search/pages/index.json", "utf8"),
) as { pages: IndexedPage[]; vectors: string };
const bytes = Buffer.from(index.vectors, "base64");
const vectors = new Float32Array(
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
);
const rows = [];
for (const item of fixtures.cases) {
  const query = await embedVisualText([
    `A printed annual report page with ${item.query}.`,
  ]);
  const hits = index.pages
    .map((p, i) => ({
      reportId: p.reportId,
      pageIndex: p.pageIndex,
      score: dot(query, vectors, i * VISUAL_DIMENSIONS),
    }))
    .filter((p) => p.reportId === item.reportId)
    .sort((a, b) => b.score - a.score);
  if (!hits.some((p) => p.pageIndex === item.pageIndex))
    throw Error(`Missing indexed gold page ${item.reportId}:${item.pageIndex}`);
  const rank = hits.findIndex((p) => p.pageIndex === item.pageIndex) + 1;
  rows.push({ ...item, rank, top5: hits.slice(0, 5) });
}
const metrics = {
  MRR10:
    rows.reduce((n, r) => n + (r.rank <= 10 ? 1 / r.rank : 0), 0) / rows.length,
  Hit10: rows.filter((r) => r.rank <= 10).length / rows.length,
};
await writeFile(
  "benchmarks/page-expansion-results.json",
  JSON.stringify({ scope: fixtures.scope, metrics, rows }, null, 2),
);
console.log(metrics);

if (
  process.argv.includes("--check") &&
  (metrics.MRR10 < 0.4 || metrics.Hit10 < 0.75)
)
  process.exitCode = 1;
