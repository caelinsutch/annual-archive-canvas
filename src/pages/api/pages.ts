import type { APIRoute } from "astro";
import { readFile, readdir } from "node:fs/promises";
import type { ArchivePage, ReportManifest } from "../../lib/types";

let catalogue: Promise<ArchivePage[]> | undefined;
async function loadPages(): Promise<ArchivePage[]> {
  const root = await readdir("public/source-manifests")
    .then(() => "public")
    .catch(() => "dist/client");
  const metadata = JSON.parse(
    await readFile(`${root}/search/pages/metadata.json`, "utf8"),
  ) as ArchivePage[];
  const pages = new Map<string, ArchivePage>();
  for (const page of metadata)
    pages.set(`${page.reportId}:${page.pageIndex}`, {
      reportId: page.reportId,
      pageIndex: page.pageIndex,
      image: page.image.startsWith("/search/")
        ? page.image
        : `/api/page?id=${encodeURIComponent(page.reportId)}&page=${page.pageIndex}`,
    });
  const files = await readdir(`${root}/source-manifests`);
  await Promise.all(
    files
      .filter((f) => f.endsWith(".json"))
      .map(async (file) => {
        const manifest = JSON.parse(
          await readFile(`${root}/source-manifests/${file}`, "utf8"),
        ) as ReportManifest;
        const reportId = file.slice(0, -5);
        for (const page of manifest.pages) {
          const key = `${reportId}:${page.index}`;
          if (!pages.has(key))
            pages.set(key, {
              reportId,
              pageIndex: page.index,
              image: `/api/page?id=${encodeURIComponent(reportId)}&page=${page.index}`,
            });
        }
      }),
  );
  // Stable mixing gives the opening canvas a range of reports and page layouts.
  const hash = (page: ArchivePage) => {
    let value = 2166136261;
    for (const char of `${page.reportId}:${page.pageIndex}`)
      value = Math.imul(value ^ char.charCodeAt(0), 16777619);
    return value >>> 0;
  };
  return [...pages.values()].sort((a, b) => hash(a) - hash(b));
}
export const GET: APIRoute = async () => {
  try {
    catalogue ||= loadPages().catch((error) => {
      catalogue = undefined;
      throw error;
    });
    return Response.json(
      { pages: await catalogue },
      { headers: { "Cache-Control": "public, max-age=300" } },
    );
  } catch {
    return Response.json(
      { error: "Pages are unavailable. Please try again." },
      { status: 503 },
    );
  }
};
