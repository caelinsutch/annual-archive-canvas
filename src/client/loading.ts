import { motion } from "../lib/motion";
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
export const frame = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, ms)));
/** Wait for actual visible images, retaining the loader until content or an explicit error can be shown. */
export async function waitForArtwork(
  root: HTMLElement,
  progress?: (loaded: number, total: number) => void,
) {
  await frame();
  const images = [...root.querySelectorAll<HTMLImageElement>("img")]
    .filter((img) => {
      const r = img.getBoundingClientRect();
      return (
        r.width > 0 &&
        r.bottom > 0 &&
        r.top < innerHeight &&
        r.right > 0 &&
        r.left < innerWidth
      );
    })
    .slice(0, 12);
  let loaded = 0;
  progress?.(0, images.length);
  await Promise.allSettled(
    images.map(async (img) => {
      try {
        await img.decode();
      } finally {
        progress?.(++loaded, images.length);
      }
    }),
  );
  await frame();
}
type IntroCanvas = {
  paused: boolean;
  cards: Map<
    string,
    { el: HTMLButtonElement; mesh: { visible: boolean } | null }
  >;
};

/** Borrow the canvas's own cards for the intro, then return them to their exact slots. */
async function revealCovers(
  el: HTMLElement,
  root: HTMLElement,
  canvas: IntroCanvas,
) {
  const stage = el.querySelector<HTMLElement>("[data-intro-stage]")!;
  const title = el.querySelector<HTMLElement>("[data-intro-title]")!;
  const candidates = [...root.querySelectorAll<HTMLButtonElement>(".artifact")]
    .filter((node) => {
      const image = node.querySelector("img");
      const rect = node.getBoundingClientRect();
      return (
        image?.naturalWidth &&
        rect.width > 0 &&
        rect.left >= 0 &&
        rect.right <= innerWidth &&
        rect.bottom > 0 &&
        rect.top < innerHeight
      );
    })
    .sort((a, b) => {
      const distance = (node: HTMLElement) => {
        const r = node.getBoundingClientRect();
        return Math.hypot(
          r.x + r.width / 2 - innerWidth / 2,
          r.y + r.height / 2 - innerHeight / 2,
        );
      };
      return distance(a) - distance(b);
    })
    .slice(0, innerWidth < 600 ? 5 : 7);
  if (!candidates.length) return false;
  canvas.paused = true;
  root.classList.add("intro-borrowing");
  const records = candidates.map((node) => ({
    node,
    parent: node.parentElement!,
    next: node.nextSibling,
    css: node.style.cssText,
    rect: node.getBoundingClientRect(),
    image: node.querySelector("img")!,
    imageCSS: node.querySelector("img")!.style.cssText,
    tabIndex: node.tabIndex,
  }));
  const animations: Animation[] = [];
  const run = async (
    node: HTMLElement,
    keys: Keyframe[],
    duration: number,
    stagger = 0,
  ) => {
    const animation = node.animate(keys, {
      duration,
      delay: stagger,
      easing: motion.ease,
      fill: "both",
    });
    animations.push(animation);
    await animation.finished.catch(() => {});
  };
  try {
    const width = Math.min(126, innerWidth * 0.23);
    const spread = Math.min(66, innerWidth * 0.105);
    const poses = records.map(({ node, image, rect }, i) => {
      const offset = i - (records.length - 1) / 2;
      const scale = width / rect.width;
      const x = innerWidth / 2 - rect.width / 2;
      const y = innerHeight / 2 - rect.height / 2;
      const stack = `translate3d(${x}px,${y + 18}px,0) rotate(0deg) scale(${scale * 0.94})`;
      const fan = `translate3d(${x + offset * spread}px,${y + Math.abs(offset) * 9}px,0) rotate(${offset * 7}deg) scale(${scale})`;
      stage.append(node);
      node.tabIndex = -1;
      Object.assign(node.style, {
        visibility: "visible",
        zIndex: String(i),
        pointerEvents: "none",
      });
      image.style.opacity = "1";
      for (const card of canvas.cards.values())
        if (card.el === node && card.mesh) card.mesh.visible = false;
      return { stack, fan };
    });
    await Promise.all(
      records.map(({ node }, i) =>
        run(
          node,
          [
            { transform: poses[i].stack, opacity: 0 },
            { transform: poses[i].fan, opacity: 1 },
          ],
          motion.loaderEnter,
          i * motion.loaderStagger,
        ),
      ),
    );
    await delay(motion.loaderHold);
    void run(
      title,
      [
        { opacity: 1, transform: "translateY(0)" },
        { opacity: 0, transform: "translateY(-8px)" },
      ],
      240,
    );
    // Only the white surface fades; the real covers travel to their existing canvas slots.
    void run(
      el.querySelector<HTMLElement>("[data-intro-surface]")!,
      [{ opacity: 1 }, { opacity: 0 }],
      motion.loaderReveal,
    );
    await Promise.all(
      records.map(({ node, rect }, i) =>
        run(
          node,
          [
            { transform: poses[i].fan, opacity: 1 },
            {
              transform: `translate3d(${rect.left}px,${rect.top}px,0) rotate(0deg) scale(1)`,
              opacity: 1,
            },
          ],
          motion.loaderReveal,
        ),
      ),
    );
  } finally {
    animations.forEach((animation) => animation.cancel());
    for (const record of records) {
      record.parent.insertBefore(
        record.node,
        record.next?.parentNode === record.parent ? record.next : null,
      );
      record.node.style.cssText = record.css;
      record.image.style.cssText = record.imageCSS;
      record.node.tabIndex = record.tabIndex;
    }
    canvas.paused = false;
    el.style.visibility = "hidden";
    await frame();
    root.classList.remove("intro-borrowing");
  }
  return true;
}

export function manageSplash(el: HTMLElement) {
  const started = performance.now();
  let finished = false;
  const background = [
    ...document.querySelectorAll<HTMLElement>(
      ".masthead, main, .dock, .skip-link",
    ),
  ].map((node) => ({ node, inert: node.inert }));
  background.forEach(({ node }) => {
    node.inert = true;
  });
  if (!reduced())
    el.querySelector("[data-intro-title]")?.animate(
      [{ opacity: 0 }, { opacity: 1 }],
      { duration: 320, easing: motion.ease },
    );
  return {
    el,
    async finish(root?: HTMLElement, canvas?: IntroCanvas | null) {
      if (finished) return;
      finished = true;
      await Promise.all([
        delay(
          reduced()
            ? 0
            : Math.max(0, motion.loaderMinimum - (performance.now() - started)),
        ),
        root ? waitForArtwork(root) : Promise.resolve(),
      ]);
      if (!el.isConnected) return;
      const revealed =
        !reduced() && root && canvas && (await revealCovers(el, root, canvas));
      if (!revealed && !reduced())
        await el
          .animate([{ opacity: 1 }, { opacity: 0 }], {
            duration: 300,
            easing: motion.ease,
            fill: "forwards",
          })
          .finished.catch(() => {});
      performance.measure(
        el.id === "app-splash" ? "archive-loader" : "report-loader",
        {
          start: started,
          end: performance.now(),
        },
      );
      el.remove();
      background.forEach(({ node, inert }) => {
        node.inert = inert;
      });
    },
  };
}
