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
export function manageSplash(el: HTMLElement) {
  const started = performance.now();
  let finished = false;
  const bar =
    el.querySelector<HTMLElement>("[data-progress]") ||
    el.querySelector<HTMLElement>("span>span");
  if (!reduced())
    el.firstElementChild?.animate(
      [
        { opacity: 0, filter: "blur(3px)", transform: "translateY(-6px)" },
        { opacity: 1, filter: "blur(0)", transform: "translateY(-12px)" },
      ],
      { duration: 380, easing: motion.ease },
    );
  const progress = (loaded: number, total: number) => {
    if (bar) bar.style.transform = `scaleX(${total ? loaded / total : 1})`;
  };
  if (bar) bar.style.transition = "transform 260ms cubic-bezier(.22,1,.36,1)";
  return {
    el,
    async finish(root?: HTMLElement) {
      if (finished) return;
      finished = true;
      await Promise.all([
        delay(
          reduced()
            ? 0
            : Math.max(0, motion.loaderMinimum - (performance.now() - started)),
        ),
        root ? waitForArtwork(root, progress) : Promise.resolve(),
      ]);
      if (!el.isConnected) return;
      progress(1, 1);
      if (!reduced())
        el.firstElementChild?.animate(
          [
            { opacity: 1, transform: "translateY(-12px)" },
            { opacity: 0, transform: "translateY(-20px)" },
          ],
          { duration: 260, easing: motion.ease, fill: "forwards" },
        );
      if (!reduced())
        await el
          .animate([{ opacity: 1 }, { opacity: 0 }], {
            duration: 420,
            easing: motion.ease,
            fill: "forwards",
          })
          .finished.catch(() => {});
      performance.measure(
        el.id === "app-splash" ? "archive-loader" : "report-loader",
        { start: started, end: performance.now() },
      );
      el.remove();
    },
  };
}
