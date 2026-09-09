import type { APIRoute } from "astro";
import { readFile } from "node:fs/promises";
import catalogue from "../../../public/catalog.json";
import { embed, DIMENSIONS } from "../../search/embedding";
import { rank } from "../../search/rank";
import type { Report } from "../../lib/types";
let index: Promise<Float32Array> | undefined;
const results = new Map<string, ReturnType<typeof rank>>();
async function loadIndex() {
  const [buffer, manifest] = await Promise.all([
    readFile("public/search/vectors.bin").catch(() =>
      readFile("dist/client/search/vectors.bin"),
    ),
    readFile("public/search/manifest.json").catch(() =>
      readFile("dist/client/search/manifest.json"),
    ),
  ]);
  const metadata = JSON.parse(manifest.toString()) as {
    ids: string[];
    dimensions: number;
  };
  if (
    metadata.dimensions !== DIMENSIONS ||
    metadata.ids.some((id, i) => id !== catalogue[i]?.id) ||
    metadata.ids.length !== catalogue.length
  )
    throw new Error("Search index does not match catalogue");
  return new Float32Array(
    buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    ),
  );
}
export const GET: APIRoute = async ({ url }) => {
  const query = (url.searchParams.get("q") || "").trim().slice(0, 200);
  if (query.length < 2) return Response.json({ hits: [] });
  try {
    let hits = results.get(query);
    if (!hits) {
      index ||= loadIndex().catch((error) => {
        index = undefined;
        throw error;
      });
      const [vector, vectors] = await Promise.all([embed(query, true), index]);
      hits = rank(query, vector, catalogue as Report[], vectors)
        .filter((hit) => hit.score >= 0.2)
        .slice(0, 120);
      results.set(query, hits);
      if (results.size > 200) results.delete(results.keys().next().value!);
    }
    return Response.json(
      { hits, mode: "hybrid" },
      { headers: { "Cache-Control": "public, max-age=3600" } },
    );
  } catch {
    return Response.json(
      { error: "Semantic search temporarily unavailable" },
      { status: 503 },
    );
  }
};
