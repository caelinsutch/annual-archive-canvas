import type { Report } from "../lib/types";
export function documentText(report: Report): string {
  return `${report.o}. Annual report ${report.y}. ${report.d || ""}. Designer: ${report.dsg || "uncredited"}. Industry: ${report.i}. Main color: ${report.k}.`;
}
export const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
export function lexicalScore(query: string, report: Report): number {
  const q = normalize(query),
    name = normalize(report.o),
    text = normalize(documentText(report));
  if (q === name || q === report.y) return 1;
  const terms = q.split(/\W+/).filter((t) => t.length > 1);
  if (!terms.length) return 0;
  const found =
    terms.reduce((sum, t) => sum + (text.includes(t) ? 1 : 0), 0) /
    terms.length;
  return Math.min(1, found * 0.7 + (name.includes(q) ? 0.3 : 0));
}
export interface SearchHit {
  id: string;
  score: number;
}
export function rank(
  query: string,
  vector: Float32Array,
  catalog: Report[],
  vectors: Float32Array,
  dimensions = 384,
): SearchHit[] {
  if (
    vector.length !== dimensions ||
    vectors.length !== catalog.length * dimensions
  )
    throw new Error("Embedding dimensions do not match catalogue");
  if ([...vector].some((n) => !Number.isFinite(n)))
    throw new Error("Invalid query vector");
  return catalog
    .map((report, index) => {
      let similarity = 0;
      const offset = index * dimensions;
      for (let d = 0; d < dimensions; d++)
        similarity += vector[d] * vectors[offset + d];
      return {
        id: report.id,
        score: similarity * 0.35 + lexicalScore(query, report) * 0.65,
      };
    })
    .sort((a, b) => b.score - a.score);
}
