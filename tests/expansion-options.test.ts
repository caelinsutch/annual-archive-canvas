import test from "node:test";
import assert from "node:assert/strict";
import { parseExpansionOptions } from "../scripts/lib/expansion-options";
test("expansion defaults to a bounded batch", () => {
  const result = parseExpansionOptions([]);
  assert.equal(result.limit, 100);
  assert.equal(result.all, false);
  assert.equal(result.concurrency, 3);
  assert.equal(result.timeout, 600);
});
test("all and explicit report selection are available", () => {
  assert.equal(parseExpansionOptions(["--all"]).all, true);
  assert.deepEqual(
    parseExpansionOptions(["--ids", "uw43767,uw43767,uw43769"]).ids,
    ["uw43767", "uw43769"],
  );
});
test("invalid or conflicting options fail before starting downloads", () => {
  for (const args of [
    ["--limit", "0"],
    ["--limit", "-5"],
    ["--concurrency", "5"],
    ["--ids", "../../file"],
    ["--all", "--limit", "1"],
    ["--typo"],
    ["--timeout", "NaN"],
    ["--ids"],
  ])
    assert.throws(() => parseExpansionOptions(args));
});
test("dry-run and help do not imply acquisition", () => {
  assert.equal(parseExpansionOptions(["--dry-run"]).dryRun, true);
  assert.equal(parseExpansionOptions(["--help"]).help, true);
});
