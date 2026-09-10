import { execFile } from "node:child_process";
import { promisify } from "node:util";
import assert from "node:assert/strict";
const run = promisify(execFile);
const base = process.env.TEST_URL || "http://localhost:3000";
const session = "annual-loader";
async function browser(...args: string[]) {
  return (
    await run("agent-browser", ["--session", session, ...args], {
      timeout: 60000,
      maxBuffer: 2e6,
    })
  ).stdout.trim();
}
async function evaluate(code: string) {
  const value = JSON.parse(await browser("eval", `JSON.stringify(${code})`));
  return typeof value === "string" ? JSON.parse(value) : value;
}
async function until(code: string) {
  for (let i = 0; i < 150; i++) {
    if (await evaluate(code)) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error("Timed out: " + code);
}
try {
  for (const [width, height] of [
    [1440, 1000],
    [390, 844],
  ]) {
    await browser("set", "viewport", String(width), String(height));
    await browser("open", base);
    await browser(
      "eval",
      `window.probe=setInterval(()=>{const cards=[...document.querySelectorAll('[data-intro-stage] .artifact')];if(cards.length){window.introCards=cards;window.introImages=cards.map(n=>n.querySelector('img'));for(const n of cards)for(const a of n.getAnimations()){a.pause();a.currentTime=a.effect.getTiming().duration+a.effect.getTiming().delay-1;}clearInterval(window.probe);}},10)`,
    );
    await until(`window.introCards?.length > 0`);
    assert.equal(
      await evaluate(
        `document.querySelector('#gallery').dataset.textureReadiness`,
      ),
      "ready",
      "Intro waits for uploaded and rendered WebGL textures",
    );
    assert.equal(
      await evaluate(
        `(()=>{const d=document.querySelector('#gallery').dataset;const total=Number(d.texturesTotal);return Number(d.texturesReady)>=Math.min(total,Math.max(12,Math.ceil(total*.85)));})()`,
      ),
      true,
      "Visible texture coverage meets the readiness threshold",
    );
    assert.equal(
      await evaluate(
        `window.introImages.every(i=>i.complete&&i.naturalWidth>0)`,
      ),
      true,
    );
    assert.equal(
      await evaluate(
        `window.introCards.every(n=>n.getBoundingClientRect().left>=0&&n.getBoundingClientRect().right<=innerWidth)`,
      ),
      true,
      "Fan fits viewport",
    );
    assert.equal(
      await evaluate(
        `getComputedStyle(document.querySelector('#gallery .webgl')).visibility`,
      ),
      "hidden",
      "No duplicate WebGL covers",
    );
    await browser("screenshot", `outputs/artwork-intro-${width}.png`);
    await browser("eval", `document.getAnimations().forEach(a=>a.play())`);
    await until(`!document.querySelector('#app-splash')`);
    assert.equal(
      await evaluate(
        `window.introCards.every((n,i)=>n.isConnected&&n.closest('#gallery')&&n.querySelector('img')===window.introImages[i])`,
      ),
      true,
      "Exact cover and image nodes survive intro",
    );
    assert.equal(
      await evaluate(`!!document.querySelector('.intro-borrowing')`),
      false,
    );
    assert.equal(
      await evaluate(
        `getComputedStyle(document.querySelector('#gallery .webgl')).visibility`,
      ),
      "visible",
    );
  }
  await browser("set", "media", "light", "reduced-motion");
  await browser("open", base);
  await until(`!document.querySelector('#app-splash')`);
  assert.equal(
    await evaluate(
      `[...document.querySelectorAll('#gallery img')].some(i=>i.naturalWidth>0)`,
    ),
    true,
    "Reduced motion reveals loaded artwork",
  );
  console.log(
    "PASS: desktop and mobile fan, decoded artwork, exact-node handoff, no duplicate rendering, reduced motion",
  );
} finally {
  await browser("close");
}
