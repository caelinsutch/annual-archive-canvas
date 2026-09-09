import type { APIRoute } from "astro";
import { readFile } from "node:fs/promises";
import { embedVisualText, VISUAL_DIMENSIONS } from "../../search/visual";
import { dot, type IndexedPage } from "../../search/taxonomy";
export const GET: APIRoute = async ({ url }) => {
  const query = (url.searchParams.get("q") || "").trim().slice(0, 200);
  if (query.length < 2) return Response.json({ hits: [], indexedPages: 0 });
  try {
    const raw = await readFile("public/search/pages/index.json", "utf8").catch(
      () => readFile("dist/client/search/pages/index.json", "utf8"),
    );
    const index = JSON.parse(raw) as {
      pages: IndexedPage[];
      vectors: string;
      dimensions: number;
    };
    const buffer = Buffer.from(index.vectors, "base64");
    const vectors = new Float32Array(
      buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength,
      ),
    );
    if (
      index.dimensions !== VISUAL_DIMENSIONS ||
      vectors.length !== index.pages.length * VISUAL_DIMENSIONS
    )
      throw new Error("Invalid page index");
    const vector = await embedVisualText([
      `A printed annual report page with ${query}.`,
    ]);
    const reportId = url.searchParams.get("reportId");
    const hits = index.pages
      .map((page, i) => ({
        ...page,
        score: dot(vector, vectors, i * VISUAL_DIMENSIONS),
      }))
      .filter(
        (page) =>
          page.score >= 0.2 && (!reportId || page.reportId === reportId),
      )
      .sort((a, b) => b.score - a.score)
      .slice(0, 40)
      .map((page) => ({
        ...page,
        image: page.image.startsWith("/search/")
          ? page.image
          : `/api/page?id=${encodeURIComponent(page.reportId)}&page=${page.pageIndex}`,
      }));
    return Response.json({
      hits,
      indexedPages: index.pages.length,
      model: "CLIP",
      tagProvenance: "visual-model",
    });
  } catch {
    return Response.json(
      { hits: [], indexedPages: 0, error: "Page indexing is still preparing" },
      { status: 503 },
    );
  }
};
