import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile } from "node:fs/promises";
const run = promisify(execFile),
  session = "annual-motion-qa";
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function b(...args: string[]) {
  return (
    await run("agent-browser", ["--session", session, ...args], {
      timeout: 90000,
      maxBuffer: 2e6,
    })
  ).stdout.trim();
}
async function e(s: string) {
  const x = JSON.parse(await b("eval", `JSON.stringify(${s})`));
  return typeof x === "string" ? JSON.parse(x) : x;
}
async function ready(s: string) {
  for (let i = 0; i < 180; i++) {
    if (await e(s)) return;
    await pause(250);
  }
  throw Error("Timeout " + s);
}
const report: any[] = [];
try {
  await b("set", "media", "light", "no-preference");
  await b("open", "http://localhost:3000");
  await ready(`!document.querySelector('#app-splash')`);
  for (const width of [320, 390, 720, 1024, 1440]) {
    await b("set", "viewport", String(width), "900");
    await pause(500);
    report.push(
      await e(
        `(()=>{const rect=s=>document.querySelector(s).getBoundingClientRect();const logo=rect('.wordmark'),search=rect('#open-search'),nav=rect('.masthead nav'),dock=rect('.dock');return {view:'archive',width:innerWidth,headerOverlap:logo.right>search.left||search.right>nav.left,dockFits:dock.left>=0&&dock.right<=innerWidth,blur:getComputedStyle(document.querySelector('.masthead')).backdropFilter}})()`,
      ),
    );
  }
  await b("open", "http://localhost:3000/#report=paulrand-cummins-1966");
  await ready(
    `document.querySelector('#reader').open&&!document.querySelector('#reader.opening-report')&&document.querySelector('#page-canvas img')?.naturalWidth>0`,
  );
  for (const width of [320, 390, 720, 1440]) {
    await b("set", "viewport", String(width), "900");
    for (const mode of ["strip", "pages", "read"]) {
      await b("eval", `document.querySelector('#${mode}-mode').click()`);
      await pause(600);
      report.push(
        await e(
          `(()=>{const d=document.querySelector('.reader-dock'),r=d.getBoundingClientRect();return {view:'reader',mode:'${mode}',width:innerWidth,dockFits:r.left>=0&&r.right<=innerWidth&&d.scrollWidth<=d.clientWidth+1,header:[...document.querySelectorAll('.reader-header button')].map(b=>({label:b.textContent.trim(),fits:b.getBoundingClientRect().right<=innerWidth&&b.scrollWidth<=b.clientWidth+1})),selection:getComputedStyle(document.querySelector('#page-canvas img')).userSelect}})()`,
        ),
      );
    }
  }
  await b("eval", `document.querySelector('#pages-mode').click()`);
  await pause(450);
  await b(
    "eval",
    `window.exitFrames=[];const d=document.querySelector('#reader');const sample=()=>{window.exitFrames.push({open:d.open,blur:getComputedStyle(d,'::backdrop').backdropFilter,hero:!!d.querySelector('.report-return'),opacity:getComputedStyle(d).opacity});if(!d.open)clearInterval(window.exitSampler)};sample();window.exitSampler=setInterval(sample,16);d.addEventListener('cancel',()=>{queueMicrotask(()=>{getComputedStyle(d,'::backdrop').backdropFilter;const animations=document.getAnimations();animations.forEach(a=>{a.pause();a.currentTime=Number(a.effect.getTiming().duration)*.8});sample();animations.forEach(a=>{a.currentTime=Number(a.effect.getTiming().duration)-.1});sample();animations.forEach(a=>a.play())})},{once:true})`,
  );
  await b("press", "Escape");
  await ready(`!document.querySelector('#reader').open`);
  report.push({ exitFrames: await e("window.exitFrames") });
  await b("set", "media", "light", "reduced-motion");
  await b("open", "http://localhost:3000");
  await ready(`!document.querySelector('#app-splash')`);
  await b("eval", `document.querySelector('#grid-view').click()`);
  await pause(150);
  report.push(
    await e(
      `({reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,animations:document.getAnimations().filter(a=>a.playState==='running'&&Number(a.effect?.getTiming().duration)>1).length})`,
    ),
  );
  await writeFile("outputs/motion-qa.json", JSON.stringify(report, null, 2));
  for (const sample of report) {
    if (sample.view) {
      assert.equal(sample.dockFits, true, JSON.stringify(sample));
      if (sample.view === "archive")
        assert.equal(sample.headerOverlap, false, JSON.stringify(sample));
      else {
        assert.equal(sample.selection, "none");
        assert.ok(sample.header.every((h: any) => h.fits));
      }
    }
    if (sample.reducedMotion) assert.equal(sample.animations, 0);
  }

  const frames = report.find((r) => r.exitFrames).exitFrames;
  assert.ok(frames.some((f: any) => f.open && f.hero && f.opacity === "1"));
  assert.ok(
    frames.some(
      (f: any) => f.open && parseFloat(f.blur.replace("blur(", "")) < 1,
    ),
  );
  console.log(
    JSON.stringify(
      report.filter((r) => !r.exitFrames),
      null,
      2,
    ),
  );
} finally {
  await b("close");
}
