export const taxonomy = {
  role: [
    "cover",
    "table of contents",
    "letter to shareholders",
    "financial table",
    "financial chart",
    "editorial article",
    "photographic spread",
    "product showcase",
    "board of directors",
    "back cover",
  ],
  layout: [
    "single column",
    "multiple columns",
    "modular grid",
    "asymmetric composition",
    "full bleed image",
    "large whitespace",
    "dense text",
    "centered composition",
  ],
  typography: [
    "large expressive typography",
    "small body text",
    "serif typography",
    "sans serif typography",
    "handwritten lettering",
    "oversized numerals",
  ],
  imagery: [
    "photography",
    "illustration",
    "abstract geometric shapes",
    "portrait photography",
    "industrial photography",
    "architectural photography",
    "line drawing",
    "collage",
  ],
  color: [
    "black and white",
    "warm orange and red",
    "cool blue and green",
    "bright primary colors",
    "muted earth tones",
    "pastel colors",
  ],
  style: [
    "minimalist graphic design",
    "Swiss modernist graphic design",
    "Bauhaus geometric design",
    "corporate editorial design",
    "expressive experimental design",
    "traditional formal design",
  ],
} as const;
export type TagGroup = keyof typeof taxonomy;
export interface DesignTag {
  group: TagGroup;
  label: string;
  similarity: number;
  provenance: "visual-model";
}
export interface IndexedPage {
  id: string;
  reportId: string;
  pageIndex: number;
  image: string;
  tags: DesignTag[];
  model: string;
  indexedAt: string;
}
export const prompts = Object.entries(taxonomy).flatMap(([group, labels]) =>
  labels.map((label) => ({
    group: group as TagGroup,
    label,
    prompt: `A printed annual report page with ${label}.`,
  })),
);
export function dot(a: Float32Array, b: Float32Array, offset = 0) {
  let score = 0;
  for (let i = 0; i < a.length; i++) score += a[i] * b[offset + i];
  return score;
}
export function classify(
  vector: Float32Array,
  labelVectors: Float32Array,
): DesignTag[] {
  return (Object.keys(taxonomy) as TagGroup[]).flatMap((group) =>
    prompts
      .map((p, i) => ({
        ...p,
        similarity: dot(vector, labelVectors, i * vector.length),
      }))
      .filter((p) => p.group === group)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, group === "imagery" ? 2 : 1)
      .filter((p) => p.similarity >= 0.18)
      .map(({ label, similarity }) => ({
        group,
        label,
        similarity,
        provenance: "visual-model" as const,
      })),
  );
}
