import type { Report, ReportManifest } from "./types";
import { resolveExternalReport } from "./source-adapters";
import { XMLParser } from "fast-xml-parser";
const parser = new XMLParser({ ignoreAttributes: false });
export function archiveIdentity(source: string) {
  const u = new URL(source);
  if (u.hostname !== "archive.org") return null;
  const p = u.pathname.split("/").filter(Boolean);
  return p[0] === "details" ? { item: p[1], book: p[2] } : null;
}
export function scanPages(
  xml: string,
  { server, dir, zip }: { server: string; dir: string; zip: string },
) {
  const parsed = parser.parse(xml) as {
    book?: { pageData?: { page?: ScanPage | ScanPage[] } };
  };

  let pages = parsed.book?.pageData?.page || [];
  if (!Array.isArray(pages)) pages = [pages];
  const stem = zip.replace(/_jp2\.zip$/, "");
  return pages
    .filter((p) => p.addToAccessFormats !== false)
    .map((p, index) => {
      const leaf = Number(p["@_leafNum"]);
      const file = `${stem}_jp2/${stem}_${String(leaf).padStart(4, "0")}.jp2`;
      const base = `https://${server}/BookReader/BookReaderImages.php?id=${encodeURIComponent(dir.split("/").pop() || "")}&zip=${encodeURIComponent(dir + "/" + zip)}&file=${encodeURIComponent(file)}`;
      return {
        index,
        leaf,
        label: p.pageNumber ? String(p.pageNumber) : String(index + 1),
        width: Number(p.cropBox?.w || p.origWidth) || 1500,
        height: Number(p.cropBox?.h || p.origHeight) || 2100,
        thumb: base + "&scale=4&rotate=0",
        image: base + "&scale=1&rotate=0",
      };
    });
}
export async function resolveReport(report: Report): Promise<ReportManifest> {
  const identity = archiveIdentity(report.s);
  if (!identity)
    return (
      (await resolveExternalReport(report)) || {
        kind: /\.pdf(?:\?|$)/i.test(report.s) ? "pdf" : "external",
        pages: [],
        source: report.s,
      }
    );
  const response = await fetch(
    "https://archive.org/metadata/" + encodeURIComponent(identity.item),
    { signal: AbortSignal.timeout(25000) },
  );
  if (!response.ok) throw new Error("Metadata unavailable");
  const m = (await response.json()) as ArchiveMetadata;
  const files = m.files || [];
  const pdfFile = files.find((file) =>
    identity.book
      ? file.name === identity.book + ".pdf"
      : /\.pdf$/i.test(file.name),
  );
  const fallback: ReportManifest = pdfFile
    ? {
        kind: "pdf",
        pages: [],
        source: report.s,
        pdf: `https://archive.org/download/${encodeURIComponent(identity.item)}/${encodeURIComponent(pdfFile.name)}`,
      }
    : { kind: "external", pages: [], source: report.s };
  const zip = files.find(
    (f) =>
      f.name.endsWith("_jp2.zip") &&
      (!identity.book || f.name === identity.book + "_jp2.zip"),
  );
  if (!zip) return fallback;
  const stem = zip.name.replace(/_jp2\.zip$/, "");
  const scan = files.find((f) => f.name === stem + "_scandata.xml");
  if (!scan) return fallback;
  const scanResponse = await fetch(
    `https://archive.org/download/${encodeURIComponent(identity.item)}/${encodeURIComponent(scan.name)}`,
    { signal: AbortSignal.timeout(25000) },
  );
  if (!scanResponse.ok) throw new Error("Scan manifest unavailable");
  const pages = scanPages(await scanResponse.text(), {
    server: m.d1,
    dir: m.dir,
    zip: zip.name,
  });
  if (pages.length <= 1 && pdfFile) return fallback;
  return {
    kind: "scans",
    pages,
    source: report.s,
    pdf: `https://archive.org/download/${encodeURIComponent(identity.item)}/${encodeURIComponent(stem + ".pdf")}`,
  };
}

interface ScanPage {
  "@_leafNum": string;
  addToAccessFormats?: boolean;
  pageNumber?: string;
  cropBox?: { w?: number; h?: number };
  origWidth?: number;
  origHeight?: number;
}
interface ArchiveMetadata {
  d1: string;
  dir: string;
  files?: { name: string }[];
}
