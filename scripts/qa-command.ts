import { execFile } from "node:child_process";
import { promisify } from "node:util";
import assert from "node:assert/strict";
const run = promisify(execFile),
  session = "annual-command",
  base = process.env.TEST_URL || "http://localhost:3000";
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function b(...args: string[]) {
  return (
    await run("agent-browser", ["--session", session, ...args], {
      timeout: 90000,
      maxBuffer: 2e6,
    })
  ).stdout.trim();
}
async function e(code: string) {
  const value = JSON.parse(await b("eval", `JSON.stringify(${code})`));
  return typeof value === "string" ? JSON.parse(value) : value;
}
async function until(code: string) {
  for (let i = 0; i < 180; i++) {
    if (await e(code)) return;
    await delay(200);
  }
  throw Error("Timed out: " + code);
}
try {
  await b("open", base);
  await until(`!document.querySelector('#app-splash')`);
  await b(
    "eval",
    `window.unfilteredCards=[...document.querySelectorAll("#gallery .artifact")];window.unfilteredImages=window.unfilteredCards.map(n=>n.querySelector("img"))`,
  );
  await b("press", "Meta+k");
  assert.equal(
    await e(
      `document.querySelectorAll('#search-dialog select,#search-dialog .suggestions,#search-dialog .eyebrow').length`,
    ),
    0,
  );
  await b("fill", "#search-input", "Cummins");
  await until(
    `document.querySelector('#report-search-results button')?.textContent.includes('Cummins')`,
  );
  await delay(1000);
  assert.equal(
    await e(
      `window.unfilteredCards.every((node,i)=>node.isConnected&&node.querySelector('img')===window.unfilteredImages[i])`,
    ),
    true,
    "Search must retain every canvas node",
  );
  assert.equal(
    await e(`document.querySelector('#open-search span').textContent`),
    "Search the archive",
  );
  assert.equal(await e(`document.querySelector('#search-done')===null`), true);
  await b("press", "ArrowDown");
  assert.equal(
    await e(
      `document.activeElement===document.querySelector('#report-search-results button')`,
    ),
    true,
  );
  await b("press", "ArrowUp");
  assert.equal(await e(`document.activeElement.id`), "search-input");
  await b("press", "Enter");
  await until(
    `document.querySelector('#reader').open&&!document.querySelector('.report-hero')`,
  );
  assert.equal(
    await e(
      `document.querySelector('#report-info h2').textContent.includes('Cummins')`,
    ),
    true,
  );
  await b("eval", `document.querySelector('#close-reader').click()`);
  await until(`!document.querySelector('#reader').open`);
  assert.equal(
    await e(`window.unfilteredCards.every(node=>node.isConnected)`),
    true,
    "Returning from a palette result restores the original canvas",
  );

  await b("click", "#pages-content");
  await until(`document.querySelector('#gallery').dataset.content==='pages'`);
  assert.equal(
    await e(
      `[...document.querySelectorAll('#gallery .artifact')].every(n=>n.dataset.tile.includes('--page-'))`,
    ),
    true,
  );
  await b(
    "eval",
    `window.pageSearchBackground=[...document.querySelectorAll('#gallery .artifact')]`,
  );
  await b("press", "Meta+k");
  await b("click", "#search-pages");
  await b("fill", "#search-input", "financial table");
  await until(`document.querySelector('#page-search-results button')!==null`);
  assert.equal(
    await e(`window.pageSearchBackground.every(node=>node.isConnected)`),
    true,
    "Page search must not filter or recreate background pages",
  );
  await b("press", "Escape");
  await until(`!document.querySelector('#search-dialog').open`);
  await b(
    "eval",
    `window.pageCards=[...document.querySelectorAll('#gallery .artifact')];window.pageImages=window.pageCards.map(n=>n.querySelector('img'));document.querySelector('#grid-view').click()`,
  );
  await delay(700);
  assert.equal(
    await e(
      `window.pageCards.every((node,i)=>node.isConnected&&node.querySelector('img')===window.pageImages[i])`,
    ),
    true,
  );
  for (const width of [320, 390, 720, 1440]) {
    await b("set", "viewport", String(width), "900");
    await delay(350);
    assert.equal(
      await e(
        `(()=>{const d=document.querySelector('.dock'),r=d.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&d.scrollWidth<=d.clientWidth+1})()`,
      ),
      true,
      `Dock at ${width}`,
    );
  }
  await b(
    "eval",
    `window.selectedPageTile=document.querySelector('#gallery .artifact').dataset.tile;document.querySelector('#gallery .artifact').click()`,
  );
  await until(
    `document.querySelector('#reader').open&&!document.querySelector('.report-hero')&&document.querySelector('#read-mode').getAttribute('aria-pressed')==='true'`,
  );
  assert.equal(
    await e(
      `location.hash.includes(encodeURIComponent(window.selectedPageTile.split('--page-')[0]))`,
    ),
    true,
  );
  const index = await e(`Number(window.selectedPageTile.split('--page-')[1])`);
  assert.equal(
    await e(
      `Number(document.querySelector('#page-number').textContent.split('/')[0].trim())`,
    ),
    index + 1,
  );
  await b("eval", `document.querySelector('#close-reader').click()`);
  await until(`!document.querySelector('#reader').open`);
  await b("click", "#covers-content");
  await until(`document.querySelector('#gallery').dataset.content==='covers'`);
  assert.equal(
    await e(
      `[...document.querySelectorAll('#gallery .artifact')].some(n=>n.dataset.tile.includes('--page-'))`,
    ),
    false,
  );
  console.log(
    "PASS: minimal command menu, keyboard navigation, page content, persistent layouts, responsive dock, exact-page opening, and cover restoration",
  );
} finally {
  await b("close");
}
