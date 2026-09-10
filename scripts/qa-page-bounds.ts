import { execFile } from "node:child_process";
import { promisify } from "node:util";
import assert from "node:assert/strict";
const run = promisify(execFile);
const session = "annual-page-bounds";
const base = process.env.TEST_URL || "http://localhost:3000";
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
  for (let i = 0; i < 120; i++) {
    if (await e(code)) return;
    await delay(250);
  }
  throw Error("Timed out: " + code);
}
const visible = `(()=>{const r=document.querySelector('#page-canvas').getBoundingClientRect();return [...document.querySelectorAll('#page-canvas [data-tile]')].filter(n=>{const b=n.getBoundingClientRect();return Math.min(r.right,b.right)-Math.max(r.left,b.left)>12&&Math.min(r.bottom,b.bottom)-Math.max(r.top,b.top)>12}).length})()`;
async function wheel(x: number, y: number, ctrl = false) {
  await b(
    "eval",
    `document.querySelector('#page-canvas').dispatchEvent(new WheelEvent('wheel',{deltaX:${x},deltaY:${y},ctrlKey:${ctrl},bubbles:true,cancelable:true}))`,
  );
  await delay(900);
  assert.ok(
    await e(visible),
    "Pages must remain visible after scrolling or zooming",
  );
}
try {
  await b("open", base + "/#report=paulrand-cummins-1962");
  await until(
    `document.querySelector('#reader').open&&!document.querySelector('.report-hero')&&document.querySelectorAll('#page-canvas [data-tile]').length>0`,
  );
  await b("click", "#pages-mode");
  await b(
    "eval",
    `window.originalPageNodes=[...document.querySelectorAll('#page-canvas [data-tile]')]`,
  );
  for (const width of [1440, 390]) {
    await b("set", "viewport", String(width), "800");
    for (const zoomDelta of [-1000, 1000]) {
      await wheel(0, zoomDelta, true);
      for (const [x, y] of [
        [-100000, -100000],
        [100000, 100000],
        [100000, -100000],
        [-100000, 100000],
      ])
        await wheel(x, y);
    }
  }
  await b("mouse", "move", "180", "300");
  await b("mouse", "down");
  await b("mouse", "move", "-10000", "-10000");
  await b("mouse", "up");
  await delay(900);
  assert.ok(await e(visible), "Dragging cannot lose the report");
  await b(
    "eval",
    `(()=>{const c=document.querySelector('#page-canvas');for(let i=0;i<100;i++)c.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));})()`,
  );
  await delay(900);
  assert.ok(await e(visible), "Keyboard panning cannot lose the report");
  await b("click", "#strip-mode");
  await delay(700);
  await b("click", "#pages-mode");
  await delay(900);
  assert.ok(await e(visible));
  assert.ok(
    await e(`window.originalPageNodes.every(n=>n.isConnected)`),
    "Mode changes must retain existing page nodes",
  );
  console.log(
    "PASS: page boundaries at both zoom limits, desktop/mobile, wheel, drag, keyboard, and mode restoration",
  );
} finally {
  await b("close");
}
