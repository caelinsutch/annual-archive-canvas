import type { Report, ReportManifest, ReportPage } from "./types";

type Json = Record<string, any>;
type Fetcher = typeof fetch;
const timeout = () => AbortSignal.timeout(25000);
const safeUrl = (value: unknown, base: string): string | null => {
  if (typeof value !== "string" || !value) return null;
  try {
    const u = new URL(value.replace(/&amp;/g, "&"), base);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch {
    return null;
  }
};
const id = (value: Json | string | undefined): string | undefined =>
  typeof value === "string" ? value : value?.id || value?.["@id"];
const label = (value: unknown, fallback: string): string => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object")
    return (
      Object.values(value)
        .flat()
        .filter((v) => typeof v === "string")
        .join(" ") || fallback
    );
  return fallback;
};

/** Parse the publisher's IIIF v2/v3 canvases; never manufacture page IDs. */
export function iiifPages(manifest: Json, source: string): ReportPage[] {
  const canvases: Json[] =
    manifest.sequences?.[0]?.canvases || manifest.items || [];
  return canvases.flatMap((canvas, index) => {
    const resource =
      canvas.images?.[0]?.resource || canvas.items?.[0]?.items?.[0]?.body;
    const body = Array.isArray(resource) ? resource[0] : resource;
    const image = safeUrl(id(body), source);
    if (!image || !body) return [];
    const service = Array.isArray(body.service)
      ? body.service[0]
      : body.service;
    const serviceUrl = safeUrl(id(service), source);
    const thumbnail = Array.isArray(canvas.thumbnail)
      ? canvas.thumbnail[0]
      : canvas.thumbnail;
    const width = Number(body.width || canvas.width),
      height = Number(body.height || canvas.height);
    if (!(width > 0 && height > 0)) return [];
    return [
      {
        index,
        label: label(canvas.label, String(index + 1)),
        width,
        height,
        image,
        thumb: serviceUrl
          ? `${serviceUrl.replace(/\/$/, "")}/full/!450,600/0/default.jpg`
          : safeUrl(id(thumbnail), source) || image,
      },
    ];
  });
}

export function contentDmIdentity(source: string) {
  const u = new URL(source);
  if (u.hostname !== "digitalcollections.lib.washington.edu") return null;
  const match = u.pathname.match(/^\/digital\/collection\/([^/]+)\/id\/(\d+)/);
  return match
    ? { origin: u.origin, collection: match[1], item: match[2] }
    : null;
}

async function json(url: string, request: Fetcher): Promise<Json> {
  const response = await request(url, { signal: timeout() });
  if (!response.ok)
    throw new Error(`Source metadata returned ${response.status}`);
  return response.json();
}

function childPages(value: unknown): Json[] {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(childPages);
  const node = value as Json;
  return node.pageptr ? [node] : Object.values(node).flatMap(childPages);
}

async function contentDm(
  report: Report,
  request: Fetcher,
): Promise<ReportManifest | null> {
  const identity = contentDmIdentity(report.s);
  if (!identity) return null;
  const { origin, collection, item } = identity;
  const root = `${origin}/digital`;
  let metadata = await json(
    `${root}/api/singleitem/collection/${collection}/id/${item}`,
    request,
  );
  const children = childPages(metadata.objectInfo);
  // Many UW records are containers holding one PDF; IIIF exposes only its cover.
  if (children.length === 1 && /\.pdf$/i.test(children[0].pagefile || "")) {
    metadata = await json(
      `${root}/api/singleitem/collection/${collection}/id/${encodeURIComponent(children[0].pageptr)}`,
      request,
    );
  }
  if (
    metadata.contentType === "application/pdf" ||
    /\.pdf$/i.test(metadata.filename || "")
  ) {
    // CONTENTdm's metadata API URIs are relative to /digital, not the origin.
    const pdf = safeUrl(
      metadata.downloadUri?.startsWith("/api/")
        ? `${root}${metadata.downloadUri}`
        : metadata.downloadUri,
      root + "/",
    );
    return pdf ? { kind: "pdf", source: report.s, pdf, pages: [] } : null;
  }
  const manifest = await json(
    `${origin}/iiif/info/${collection}/${item}/manifest.json`,
    request,
  );
  const pages = iiifPages(manifest, report.s);
  return pages.length ? { kind: "scans", source: report.s, pages } : null;
}

/** Only image links explicitly published under this report/year are eligible. */
export function paulRandImages(html: string, report: Report): string[] {
  const urls = [...html.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["']/gi)].flatMap(
    (match) => {
      const url = safeUrl(match[1], report.s);
      if (!url) return [];
      const decoded = decodeURIComponent(url);
      return new URL(url).hostname === "assets.paulrand.design" &&
        /annual[ -]?reports?/i.test(decoded) &&
        new RegExp(`(?:\\D|^)${report.y}(?:\\D|$)`).test(decoded) &&
        /\.(webp|jpg|jpeg|png)$/i.test(url)
        ? [url]
        : [];
    },
  );
  return [...new Set(urls)];
}

/** WebP dimensions from the actual image header, preserving each spread's aspect ratio. */
export function webpDimensions(
  bytes: Uint8Array,
): { width: number; height: number } | null {
  const str = (start: number, end: number) =>
    String.fromCharCode(...bytes.slice(start, end));
  if (bytes.length < 30 || str(0, 4) !== "RIFF" || str(8, 12) !== "WEBP")
    return null;
  const uint24 = (offset: number) =>
    bytes[offset] + (bytes[offset + 1] << 8) + (bytes[offset + 2] << 16);
  if (str(12, 16) === "VP8X")
    return { width: uint24(24) + 1, height: uint24(27) + 1 };
  if (str(12, 16) === "VP8 ")
    return {
      width: (bytes[26] | (bytes[27] << 8)) & 0x3fff,
      height: (bytes[28] | (bytes[29] << 8)) & 0x3fff,
    };
  if (str(12, 16) === "VP8L" && bytes[20] === 0x2f)
    return {
      width: 1 + (bytes[21] | ((bytes[22] & 0x3f) << 8)),
      height:
        1 + ((bytes[22] >> 6) | (bytes[23] << 2) | ((bytes[24] & 15) << 10)),
    };
  return null;
}

async function imageDimensions(url: string, request: Fetcher) {
  const response = await request(url, {
    headers: { Range: "bytes=0-63" },
    signal: timeout(),
  });
  if (!response.ok || !response.body) return null;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (size < 64) {
      const { value, done } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.length;
    }
  } finally {
    await reader.cancel();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return webpDimensions(bytes);
}

export async function resolveExternalReport(
  report: Report,
  request: Fetcher = fetch,
): Promise<ReportManifest | null> {
  const source = new URL(report.s);
  if (/\.pdf$/i.test(source.pathname))
    return { kind: "pdf", pages: [], source: report.s, pdf: report.s };
  if (contentDmIdentity(report.s)) return contentDm(report, request);
  if (
    source.hostname === "texashistory.unt.edu" &&
    /^\/ark:\/67531\/[^/]+/.test(source.pathname)
  ) {
    const base =
      source.origin + source.pathname.match(/^\/ark:\/67531\/[^/]+/)![0] + "/";
    const pages = iiifPages(await json(base + "manifest/", request), report.s);
    return pages.length ? { kind: "scans", source: report.s, pages } : null;
  }
  if (source.hostname === "paulrand.design") {
    const response = await request(report.s, { signal: timeout() });
    if (!response.ok)
      throw new Error(`Source page returned ${response.status}`);
    const urls = paulRandImages(await response.text(), report);
    const pages: ReportPage[] = [];
    // Bounded concurrency is friendly to the archive and avoids opening hundreds of requests.
    for (let start = 0; start < urls.length; start += 6) {
      const batch = await Promise.all(
        urls.slice(start, start + 6).map(async (image, offset) => {
          const size = await imageDimensions(image, request);
          return size && size.width > 0 && size.height > 0
            ? {
                index: start + offset,
                label: String(start + offset + 1),
                ...size,
                thumb: image,
                image,
              }
            : null;
        }),
      );
      pages.push(...batch.filter((page): page is ReportPage => page !== null));
    }
    return pages.length ? { kind: "scans", source: report.s, pages } : null;
  }
  return null;
}
