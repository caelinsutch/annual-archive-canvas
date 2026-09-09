import type { IndexedPage } from "../../search/taxonomy";
import { readFile } from "node:fs/promises";
import type { APIRoute } from "astro";
import catalogue from "../../../public/catalog.json";
import { resolveReport } from "../../lib/report-api";
import type { Report, ReportManifest } from "../../lib/types";
const reports = new Map((catalogue as Report[]).map((r) => [r.id, r]));
const cache = new Map<string, Promise<ReportManifest>>();
function manifest(report: Report) {
  let result = cache.get(report.id);
  if (!result) {
    result = readFile(`public/source-manifests/${report.id}.json`, "utf8")
      .catch(() =>
        readFile(`dist/client/source-manifests/${report.id}.json`, "utf8"),
      )
      .then((text) => JSON.parse(text) as ReportManifest)
      .catch(() => resolveReport(report));
    cache.set(report.id, result);
    result.catch(() => cache.delete(report.id));
  }
  return result;
}
async function proxy(source: string, type: string, timeout: number) {
  const response = await fetch(source, {
    signal: AbortSignal.timeout(timeout),
  });
  if (!response.ok) throw new Error("Source unavailable");
  return new Response(response.body, {
    headers: {
      "Content-Type": type,
      "Cache-Control": "public, max-age=604800",
    },
  });
}
export const GET: APIRoute = async ({ url, params }) => {
  const report = reports.get(url.searchParams.get("id") || "");
  if (!report) return new Response("Report not found", { status: 404 });
  try {
    if (params.action === "report") {
      const result = await manifest(report);
      const indexed: IndexedPage[] = JSON.parse(
        await readFile("public/search/pages/metadata.json", "utf8")
          .catch(() =>
            readFile("dist/client/search/pages/metadata.json", "utf8"),
          )
          .catch(() => "[]"),
      );
      const design = Object.fromEntries(
        indexed
          .filter((page) => page.reportId === report.id)
          .map((page) => [page.pageIndex, page.tags]),
      );
      return Response.json({
        design,
        ...result,
        pages: result.pages.map((page) => ({
          ...page,
          thumb: `/api/page?id=${encodeURIComponent(report.id)}&page=${page.index}`,
          image: `/api/page?id=${encodeURIComponent(report.id)}&page=${page.index}&quality=full`,
        })),
      });
    }
    if (params.action === "page") {
      const index = Number(url.searchParams.get("page"));
      const result = await manifest(report);
      if (!Number.isInteger(index) || index < 0 || !result.pages[index])
        return new Response("Page not found", { status: 404 });
      const p = result.pages[index];
      return await proxy(
        url.searchParams.get("quality") === "full" ? p.image : p.thumb,
        "image/jpeg",
        45000,
      );
    }
    if (params.action === "cover")
      return await proxy(
        "https://annualreport.gallery/" + report.img,
        "image/jpeg",
        20000,
      );
    if (params.action === "pdf") {
      const result = await manifest(report);
      const pdf =
        result.pdf || (/\.pdf(?:\?|$)/i.test(report.s) ? report.s : null);
      if (pdf) return await proxy(pdf, "application/pdf", 60000);
    }
    return new Response("Not found", { status: 404 });
  } catch {
    return Response.json(
      { error: "The source archive could not be reached. Please try again." },
      { status: 502 },
    );
  }
};
