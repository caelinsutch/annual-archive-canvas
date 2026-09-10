import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { resolve } from "node:path";
const exec = promisify(execFile);
const entry = resolve("scripts/expand-pages.ts");

async function fixture(run: (cwd: string) => Promise<void>) {
  await mkdir("work", { recursive: true });
  const cwd = await mkdtemp(resolve("work/expansion-test-"));
  try {
    for (const dir of [
      "public/source-manifests",
      "public/search/pages",
      "scripts",
      "tests",
    ])
      await mkdir(`${cwd}/${dir}`, { recursive: true });
    await writeFile(`${cwd}/package.json`, '{"type":"module"}');
    await writeFile(
      `${cwd}/public/catalog.json`,
      '[{"id":"example","o":"Example","y":"1960"}]',
    );
    await writeFile(
      `${cwd}/public/source-manifests/example.json`,
      '{"kind":"pdf","pdf":"https://example.com/report.pdf"}',
    );
    await writeFile(`${cwd}/public/search/pages/metadata.json`, "[]");
    await writeFile(`${cwd}/README.md`, "Index: **0 pages across 0 reports**.");
    const header = 'import {appendFile,writeFile} from "node:fs/promises";';
    await writeFile(
      `${cwd}/scripts/cache-pdf-pages.ts`,
      `${header}
      await appendFile("stages.txt", "download\\n");
      await writeFile(process.env.CACHE_PROGRESS_PATH, JSON.stringify(process.env.FIXTURE_FAILURE ? [{id:"example",error:"HTTP 503"}] : [{id:"example",pages:2}]));`,
    );
    await writeFile(
      `${cwd}/scripts/index-pages.ts`,
      `${header}
      if(process.env.PAGE_LIMIT || process.env.INCLUDE_PDFS) throw Error("Leaked index selection");
      await appendFile("stages.txt", "index\\n");
      if(!process.env.FIXTURE_FAILURE) await writeFile("public/search/pages/metadata.json", '[{"reportId":"example"},{"reportId":"example"}]');`,
    );
    for (const name of [
      "benchmark-search",
      "evaluate-pages",
      "evaluate-page-expansion",
    ])
      await writeFile(
        `${cwd}/scripts/${name}.ts`,
        `${header}await appendFile("stages.txt", "${name}\\n"); if(process.env.FIXTURE_EVAL_FAILURE)process.exit(1);`,
      );
    await writeFile(
      `${cwd}/tests/cached-pages.test.ts`,
      `${header}await appendFile("stages.txt", "integrity\\n");`,
    );
    await run(cwd);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}
const invoke = (cwd: string, env: NodeJS.ProcessEnv = {}) =>
  exec(process.execPath, ["--import", "tsx", entry, "--all"], {
    cwd,
    env: { ...process.env, PAGE_LIMIT: "1", INCLUDE_PDFS: "1", ...env },
  });

test("expansion runs acquisition, indexing and checks before refreshing coverage", async () =>
  fixture(async (cwd) => {
    await invoke(cwd);
    assert.equal(
      await readFile(`${cwd}/stages.txt`, "utf8"),
      "download\nindex\nbenchmark-search\nevaluate-pages\nevaluate-page-expansion\nintegrity\n",
    );
    assert.match(
      await readFile(`${cwd}/README.md`, "utf8"),
      /2 pages across 1 reports/,
    );
    const runs = await readdir(`${cwd}/work/expansions`);
    assert.equal(runs.length, 1);
    const summary = JSON.parse(
      await readFile(`${cwd}/work/expansions/${runs[0]}/summary.json`, "utf8"),
    );
    assert.equal(summary.addedPages, 2);
    assert.deepEqual(summary.failures, []);
  }));

test("partial downloads are checked and failures return an actionable retry", async () =>
  fixture(async (cwd) => {
    await assert.rejects(
      invoke(cwd, { FIXTURE_FAILURE: "1" }),
      (error: any) => {
        assert.equal(error.code, 2);
        assert.match(error.stderr, /--ids example/);
        return true;
      },
    );
    assert.match(await readFile(`${cwd}/stages.txt`, "utf8"), /integrity/);
    assert.ok(
      !(await readdir(`${cwd}/work/expansions`)).includes("active.lock"),
    );
  }));

test("failed evaluations do not refresh README and release the workflow lock", async () =>
  fixture(async (cwd) => {
    await assert.rejects(invoke(cwd, { FIXTURE_EVAL_FAILURE: "1" }));
    assert.match(
      await readFile(`${cwd}/README.md`, "utf8"),
      /0 pages across 0 reports/,
    );
    assert.ok(
      !(await readdir(`${cwd}/work/expansions`)).includes("active.lock"),
    );
  }));

test("a second workflow refuses an existing active lock without touching data", async () =>
  fixture(async (cwd) => {
    await mkdir(`${cwd}/work/expansions`, { recursive: true });
    await writeFile(`${cwd}/work/expansions/active.lock`, "existing");
    await assert.rejects(invoke(cwd), /Another expansion may be running/);
    assert.equal(
      await readFile(`${cwd}/work/expansions/active.lock`, "utf8"),
      "existing",
    );
    await assert.rejects(readFile(`${cwd}/stages.txt`), { code: "ENOENT" });
  }));
