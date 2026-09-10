import { readFile, writeFile, mkdir, readdir, rename } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import sharp from "sharp";
import type { Report, ReportManifest } from "../src/lib/types";
const exec = promisify(execFile);
const catalog: Report[] = JSON.parse(
  await readFile("public/catalog.json", "utf8"),
);
const indexed = new Set(
  JSON.parse(await readFile("public/search/pages/metadata.json", "utf8")).map(
    (p: { reportId: string }) => p.reportId,
  ),
);
const selected = process.env.REPORT_IDS?.split(",");
const limit = Number(process.env.REPORT_LIMIT || 100);
const concurrency = Math.max(
  1,
  Math.min(4, Number(process.env.REPORT_CONCURRENCY || 3)),
);
const candidates: { report: Report; manifest: ReportManifest }[] = [];
for (const report of catalog) {
  if (selected && !selected.includes(report.id)) continue;
  const manifest: ReportManifest | null = await readFile(
    `public/source-manifests/${report.id}.json`,
    "utf8",
  )
    .then(JSON.parse)
    .catch(() => null);
  if (
    manifest?.kind === "pdf" &&
    manifest.pdf &&
    (selected || !indexed.has(report.id))
  )
    candidates.push({ report, manifest });
}
// Round-robin issuers so a batch adds breadth instead of only one company's series.
const groups = new Map<string, typeof candidates>();
for (const item of candidates.sort((a, b) =>
  a.report.y.localeCompare(b.report.y),
)) {
  const key = item.report.o;
  groups.set(key, [...(groups.get(key) || []), item]);
}
const batch: typeof candidates = [];
while (batch.length < limit && [...groups.values()].some((g) => g.length))
  for (const group of groups.values()) {
    if (group.length && batch.length < limit) batch.push(group.shift()!);
  }
await mkdir("work/pdf-cache", { recursive: true });
const outcomes: {
  id: string;
  pages?: number;
  sha256?: string;
  source: string;
  error?: string;
}[] = [];
let progressWrite = Promise.resolve();
async function cache({ report, manifest }: (typeof candidates)[number]) {
  const id = report.id,
    folder = `work/pdf-cache/${id}`;
  try {
    await mkdir(folder, { recursive: true });
    const cachedSource = await readFile(
      folder + "/source-url.txt",
      "utf8",
    ).catch(() => null);
    let bytes =
      cachedSource === manifest.pdf
        ? await readFile(folder + "/original.pdf").catch(() => null)
        : null;
    if (!bytes) {
      console.log(`Downloading ${id}: ${report.o} (${report.y})`);
      const response = await fetch(manifest.pdf!, {
        signal: AbortSignal.timeout(
          Number(process.env.PDF_TIMEOUT_MS || 90000),
        ),
      });
      if (!response.ok) throw Error(`PDF HTTP ${response.status}`);
      bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.subarray(0, 5).toString() !== "%PDF-")
        throw Error("Response is not a PDF");
      await writeFile(folder + "/original.pdf", bytes);
      await writeFile(folder + "/source-url.txt", manifest.pdf!);
    }
    console.log(
      `${id}: PDF ready (${(bytes.length / 1024 / 1024).toFixed(1)} MB); checking pages`,
    );
    const info = await exec("pdfinfo", [folder + "/original.pdf"], {
      timeout: 30000,
    });
    const count = Number(info.stdout.match(/^Pages:\s+(\d+)/m)?.[1]);
    if (!count || count > 500) throw Error(`Unexpected page count ${count}`);
    console.log(`${id}: rendering ${count} pages`);
    await exec(
      "pdftoppm",
      [
        "-jpeg",
        "-jpegopt",
        "quality=82",
        "-scale-to",
        "1600",
        folder + "/original.pdf",
        folder + "/page",
      ],
      {
        timeout: Number(process.env.PDF_RENDER_TIMEOUT_MS || 180000),
        maxBuffer: 2e6,
      },
    );
    const names = (await readdir(folder))
      .filter((n) => /^page-\d+\.jpg$/.test(n))
      .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
    if (names.length !== count)
      throw Error("Rendered page count differs from PDF");
    const output = `public/report-pages/${id}`;
    await mkdir(output, { recursive: true });
    const pages = [];
    for (let index = 0; index < names.length; index++) {
      const image = sharp(folder + "/" + names[index]);
      const metadata = await image.metadata();
      await image
        .jpeg({ quality: 78, mozjpeg: true })
        .toFile(`${output}/${index}.jpg`);
      await sharp(folder + "/" + names[index])
        .resize({ width: 600, height: 600, fit: "inside" })
        .jpeg({ quality: 76, mozjpeg: true })
        .toFile(`${output}/${index}-thumb.jpg`);
      pages.push({
        index,
        label: String(index + 1),
        width: metadata.width!,
        height: metadata.height!,
        thumb: `/report-pages/${id}/${index}-thumb.jpg`,
        image: `/report-pages/${id}/${index}.jpg`,
      });
    }
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const result: ReportManifest = {
      ...manifest,
      kind: "scans",
      pages,
      download: {
        url: manifest.pdf!,
        sha256,
        bytes: bytes.length,
        pageCount: count,
        cachedAt: new Date().toISOString(),
      },
    };
    const target = `public/source-manifests/${id}.json`;
    await writeFile(target + ".tmp", JSON.stringify(result));
    await rename(target + ".tmp", target);
    outcomes.push({ id, pages: count, sha256, source: manifest.pdf! });
    console.log(
      `${outcomes.length}/${batch.length} ${id}: ${count} pages cached`,
    );
  } catch (error) {
    outcomes.push({ id, source: manifest.pdf!, error: String(error) });
    console.error(id, String(error));
  }
  const snapshot = JSON.stringify(outcomes, null, 2);
  const progressPath =
    process.env.CACHE_PROGRESS_PATH || "work/pdf-cache/progress.json";
  progressWrite = progressWrite.then(async () => {
    await writeFile(progressPath + ".tmp", snapshot);
    await rename(progressPath + ".tmp", progressPath);
  });
  await progressWrite;
}
let cursor = 0;
await Promise.all(
  Array.from({ length: concurrency }, async () => {
    while (cursor < batch.length) await cache(batch[cursor++]);
  }),
);
await mkdir("docs", { recursive: true });
const reportPath =
  process.env.CACHE_REPORT_PATH || "docs/page-cache-expansion.json";
const previous = await readFile(reportPath, "utf8")
  .then(JSON.parse)
  .catch(() => ({ reports: [] }));
const combined = new Map<string, (typeof outcomes)[number]>(
  previous.reports.map((row: (typeof outcomes)[number]) => [row.id, row]),
);
for (const row of outcomes) combined.set(row.id, row);
await writeFile(
  reportPath,
  JSON.stringify(
    { generatedAt: new Date().toISOString(), reports: [...combined.values()] },
    null,
    2,
  ),
);

console.log(
  `DONE ${outcomes.filter((r) => r.pages).length} reports, ${outcomes.reduce((n, r) => n + (r.pages || 0), 0)} pages`,
);
