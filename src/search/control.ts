import type { Report } from "../lib/types";
export interface SearchFilters {
  decade?: string;
  industry?: string;
  color?: string;
  savedOnly?: boolean;
  saved?: Set<string>;
}
export function matchesFilters(report: Report, filter: SearchFilters) {
  return (
    (!filter.decade || report.y.startsWith(filter.decade.slice(0, 3))) &&
    (!filter.industry || report.i === filter.industry) &&
    (!filter.color || report.k === filter.color) &&
    (!filter.savedOnly || !!filter.saved?.has(report.id))
  );
}
/** A stale response must never repaint results after a newer request or reset. */
export class SearchGeneration {
  private generation = 0;
  next() {
    return ++this.generation;
  }
  isCurrent(token: number) {
    return token === this.generation;
  }
}
