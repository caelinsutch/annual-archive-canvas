import { execFile } from "node:child_process";
import { promisify } from "node:util";
const execute = promisify(execFile);
import { readFile, writeFile, mkdir, readdir, rename } from "node:fs/promises";
import {
  embedImage,
  embedVisualText,
  VISUAL_MODEL,
  VISUAL_DIMENSIONS,
} from "../src/search/visual";
import { prompts, classify, type IndexedPage } from "../src/search/taxonomy";
import type { ReportManifest } from "../src/lib/types";
const root = "public/search/pages";
await mkdir(root, { recursive: true });
await mkdir("work/page-index", { recursive: true });
const labels = await embedVisualText(prompts.map((p) => p.prompt));
const selected = process.env.REPORT_IDS?.split(",");
const limit = Number(process.env.PAGE_LIMIT || Infinity);
const files = (await readdir("public/source-manifests")).filter(
  (f) =>
    f.endsWith(".json") &&
    (!selected || selected.includes(f.replace(".json", ""))),
);
const metadata: IndexedPage[] = JSON.parse(
  await readFile(root + "/metadata.json", "utf8").catch(() => "[]"),
);
const existing = JSON.parse(
  await readFile(root + "/index.json", "utf8").catch(() => "null"),
) as { vectors: string } | null;
if (existing) {
  const bytes = Buffer.from(existing.vectors, "base64");
  for (let i = 0; i < metadata.length; i++)
    await writeFile(
      `work/page-index/${metadata[i].id}.bin`,
      bytes.subarray(
        i * VISUAL_DIMENSIONS * 4,
        (i + 1) * VISUAL_DIMENSIONS * 4,
      ),
    );
}
const known = new Set(metadata.map((p) => p.id));
let count = 0;
const failures: { id: string; error: string }[] = [];
async function checkpoint() {
  const chunks = await Promise.all(
    metadata.map((page) => readFile(`work/page-index/${page.id}.bin`)),
  );
  // One atomic snapshot keeps vectors and metadata aligned for live readers.
  const binary = Buffer.concat(chunks);
  await writeFile(
    root + "/index.tmp.json",
    JSON.stringify({
      model: VISUAL_MODEL,
      dimensions: VISUAL_DIMENSIONS,
      pages: metadata,
      vectors: binary.toString("base64"),
    }),
  );
  await rename(root + "/index.tmp.json", root + "/index.json");
  await writeFile(root + "/metadata.tmp.json", JSON.stringify(metadata));
  await rename(root + "/metadata.tmp.json", root + "/metadata.json");
  console.log(
    `Visual index: ${metadata.length} pages, ${failures.length} failures`,
  );
}
for (const file of files) {
  const manifest: ReportManifest = JSON.parse(
    await readFile("public/source-manifests/" + file, "utf8"),
  );
  const reportId = file.replace(".json", "");
  if (
    manifest.kind === "pdf" &&
    process.env.INCLUDE_PDFS === "1" &&
    manifest.pdf
  ) {
    const folder = `work/page-index/pdf-${reportId}`;
    await mkdir(folder, { recursive: true });
    try {
      const cached = await readFile(folder + "/source-url.txt", "utf8").catch(
        () => null,
      );
      if (cached !== manifest.pdf) {
        const response = await fetch(manifest.pdf, {
          signal: AbortSignal.timeout(60000),
        });
        if (!response.ok) throw new Error(`PDF HTTP ${response.status}`);
        const bytes = Buffer.from(await response.arrayBuffer());
        if (bytes.subarray(0, 5).toString() !== "%PDF-")
          throw new Error("Source did not return a PDF");
        await writeFile(folder + "/report.pdf", bytes);
        await writeFile(folder + "/source-url.txt", manifest.pdf);
      }
      await execute(
        "pdftoppm",
        ["-jpeg", "-scale-to", "600", folder + "/report.pdf", folder + "/page"],
        { timeout: 120000 },
      );
      const names = (await readdir(folder))
        .filter((f) => /^page-\d+\.jpg$/.test(f))
        .sort(
          (a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]),
        );
      await mkdir("public/search/page-thumbnails", { recursive: true });
      manifest.pages = [];
      for (let i = 0; i < names.length; i++) {
        const path = `public/search/page-thumbnails/${reportId}--${i}.jpg`;
        await writeFile(path, await readFile(folder + "/" + names[i]));
        manifest.pages.push({
          index: i,
          label: String(i + 1),
          width: 1,
          height: 1,
          thumb: path,
          image: path,
        });
      }
    } catch (error) {
      failures.push({ id: reportId, error: String(error) });
      continue;
    }
  }
  if (!manifest.pages.length) continue;
  for (const page of manifest.pages) {
    const id = `${reportId}--${page.index}`;
    if (known.has(id)) continue;
    if (count >= limit) break;
    try {
      let bytes: Uint8Array;
      if (page.thumb.startsWith("public/")) bytes = await readFile(page.thumb);
      else if (
        /^\/(?:report-pages|search)\/[a-zA-Z0-9_./-]+$/.test(page.thumb) &&
        !page.thumb.includes("..")
      )
        bytes = await readFile("public" + page.thumb);
      else {
        const response = await fetch(page.thumb, {
          signal: AbortSignal.timeout(30000),
        });
        if (!response.ok) throw new Error(`Image HTTP ${response.status}`);
        bytes = new Uint8Array(await response.arrayBuffer());
      }
      const path = `work/page-index/current-image`;
      await writeFile(path, bytes);
      const vector = await embedImage(path);
      if (vector.length !== VISUAL_DIMENSIONS)
        throw new Error("Invalid visual embedding");
      await writeFile(`work/page-index/${id}.bin`, Buffer.from(vector.buffer));
      metadata.push({
        id,
        reportId,
        pageIndex: page.index,
        image: page.thumb.replace(/^public\//, "/"),
        tags: classify(vector, labels),
        model: VISUAL_MODEL,
        indexedAt: new Date().toISOString(),
      });
      known.add(id);
      count++;
      if (count % 20 === 0) await checkpoint();
    } catch (error) {
      failures.push({ id, error: String(error) });
      console.error(id, String(error));
    }
  }
  if (count >= limit) break;
}
await checkpoint();
await writeFile(root + "/failures.json", JSON.stringify(failures, null, 2));
