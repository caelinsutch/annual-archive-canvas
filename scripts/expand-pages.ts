import { spawn } from "node:child_process";
import { writeSync } from "node:fs";
import { mkdir, open, readFile, writeFile, unlink } from "node:fs/promises";
import { parseExpansionOptions } from "./lib/expansion-options";
const options = parseExpansionOptions(process.argv.slice(2));
if (options.help) {
  console.log(`Expand Annual Archive's downloaded pages and visual search.

npm run expand:pages                    Download up to 100 more PDF reports
npm run expand:pages -- --all            Process all remaining verified PDFs
npm run expand:pages -- --limit 25       Run a smaller batch
npm run expand:pages -- --ids uw43767    Target specific catalogue IDs (comma-separated)
npm run expand:pages -- --dry-run        Preview the batch without downloads

Options: --concurrency 1..4 (default 3), --timeout SECONDS (default 600).
Requires Poppler (pdfinfo and pdftoppm). Models download on first use.
Downloads and embeddings resume from existing files. Failed sources are recorded;
rerun with --ids to retry them. Logs and the summary are saved under work/expansions/.`);
  process.exit(0);
}

const catalog = JSON.parse(await readFile("public/catalog.json", "utf8")) as {
  id: string;
  o: string;
  y: string;
}[];
const known = new Set<string>(catalog.map((r) => r.id));
for (const id of options.ids || [])
  if (!known.has(id)) throw Error(`Unknown report ID: ${id}`);
const indexedBefore = JSON.parse(
  await readFile("public/search/pages/metadata.json", "utf8"),
) as { reportId: string }[];
const indexed = new Set(indexedBefore.map((p) => p.reportId));
const eligible = [];
for (const report of catalog) {
  if (options.ids && !options.ids.includes(report.id)) continue;
  const manifest = await readFile(
    `public/source-manifests/${report.id}.json`,
    "utf8",
  )
    .then(JSON.parse)
    .catch(() => null);
  if (
    manifest?.kind === "pdf" &&
    manifest.pdf &&
    (options.ids || !indexed.has(report.id))
  )
    eligible.push(report);
}
console.log(
  `${eligible.length} eligible PDFs; batch limit ${options.all ? "all" : options.limit}. Current visual index: ${indexedBefore.length} pages / ${indexed.size} reports.`,
);
if (options.dryRun) {
  console.log(
    "No downloads or index changes. Run without --dry-run to acquire pages.",
  );
  process.exit(0);
}
await mkdir("work/expansions", { recursive: true });
// Refuse overlapping workflows: the visual index has one writer.
const lockPath = "work/expansions/active.lock";
const lock = await open(lockPath, "wx").catch(() => {
  throw Error(
    `Another expansion may be running. Check ${lockPath} before removing a stale lock.`,
  );
});
await lock.writeFile(
  JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }),
);
await lock.close();
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const folder = `work/expansions/${runId}`;

const env: NodeJS.ProcessEnv = {
  ...process.env,
  REPORT_LIMIT: String(options.all ? catalog.length : options.limit),
  REPORT_CONCURRENCY: String(options.concurrency),
  PDF_TIMEOUT_MS: String(options.timeout * 1000),
  PDF_RENDER_TIMEOUT_MS: "300000",
  CACHE_PROGRESS_PATH: `${folder}/downloads.json`,
};
// Do not accidentally inherit a previous batch's selection or alternate output path.
delete env.REPORT_IDS;
delete env.CACHE_REPORT_PATH;
delete env.PAGE_LIMIT;
delete env.INCLUDE_PDFS;
if (options.ids) env.REPORT_IDS = options.ids.join(",");
async function run(script: string, args: string[] = []) {
  console.log(`\n→ ${script}`);
  const log = await open(`${folder}/${script.replaceAll("/", "-")}.log`, "a");
  let code: number;
  try {
    code = await new Promise<number>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        ["--import", "tsx", script, ...args],
        {
          env: {
            ...env,
            REPORT_IDS:
              script === "scripts/cache-pdf-pages.ts"
                ? env.REPORT_IDS
                : undefined,
          },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      child.stdout.on("data", (chunk) => {
        process.stdout.write(chunk);
        writeSync(log.fd, chunk);
      });
      child.stderr.on("data", (chunk) => {
        process.stderr.write(chunk);
        writeSync(log.fd, chunk);
      });
      child.on("error", reject);
      child.on("close", (code) => resolve(code ?? 1));
    });
  } finally {
    await log.close();
  }
  if (code !== 0)
    throw Error(
      `${script} failed; see ${folder}. Successful downloads are preserved.`,
    );
}
try {
  await mkdir(folder, { recursive: true });
  await writeFile(`${folder}/downloads.json`, "[]");
  await run("scripts/cache-pdf-pages.ts");
  await run("scripts/index-pages.ts");
  await run("scripts/benchmark-search.ts", ["--check"]);
  await run("scripts/evaluate-pages.ts", ["--check"]);
  await run("scripts/evaluate-page-expansion.ts", ["--check"]);
  await run("tests/cached-pages.test.ts");
  const pages = JSON.parse(
    await readFile("public/search/pages/metadata.json", "utf8"),
  ) as { reportId: string }[];
  const reports = new Set(pages.map((p) => p.reportId)).size;
  const downloads = JSON.parse(
    await readFile(`${folder}/downloads.json`, "utf8"),
  ) as { id: string; pages?: number; error?: string }[];
  const summary = {
    finishedAt: new Date().toISOString(),
    addedPages: pages.length - indexedBefore.length,
    indexedPages: pages.length,
    indexedReports: reports,
    downloadedReports: downloads.filter((r) => r.pages).length,
    failures: downloads.filter((r) => r.error),
  };
  await writeFile(`${folder}/summary.json`, JSON.stringify(summary, null, 2));
  const readme = await readFile("README.md", "utf8");
  await writeFile(
    "README.md",
    readme.replace(
      /\*\*[\d,]+ pages across [\d,]+ reports\*\*/,
      `**${pages.length.toLocaleString("en-US")} pages across ${reports.toLocaleString("en-US")} reports**`,
    ),
  );
  console.log(
    `\nAdded ${summary.addedPages} indexed pages. Total: ${pages.length} pages / ${reports} reports.\nSummary: ${folder}/summary.json`,
  );
  if (summary.failures.length) {
    console.error(
      "Retry failed sources with: npm run expand:pages -- --ids " +
        summary.failures.map((r) => r.id).join(","),
    );
    process.exitCode = 2;
  }
} finally {
  await unlink(lockPath);
}
