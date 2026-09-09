import { motion } from "../lib/motion";
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
export const frame = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, ms)));
/** Wait for actual visible images, retaining the loader until content or an explicit error can be shown. */
export async function waitForArtwork(root: HTMLElement) {
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
  await Promise.race([
    Promise.allSettled(images.map((img) => img.decode())),
    delay(12000),
  ]);
  await frame();
}
export function manageSplash(el: HTMLElement) {
  const started = performance.now();
  let finished = false;
  const bar =
    el.querySelector<HTMLElement>("[data-progress]") ||
    el.querySelector<HTMLElement>("span>span");
  const animation = !reduced()
    ? bar?.animate(
        [{ transform: "translateX(-110%)" }, { transform: "translateX(210%)" }],
        { duration: 1350, iterations: Infinity, easing: "ease-in-out" },
      )
    : undefined;
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
        root ? waitForArtwork(root) : Promise.resolve(),
      ]);
      if (!el.isConnected) return;
      animation?.cancel();
      if (!reduced())
        await el
          .animate([{ opacity: 1 }, { opacity: 0 }], {
            duration: 240,
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
