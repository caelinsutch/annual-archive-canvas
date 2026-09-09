import { cx } from "../styles/ui";
import { motion } from "../lib/motion";
import type { CoverRect } from "../lib/types";
export const reducedMotion = () =>
  matchMedia("(prefers-reduced-motion: reduce)").matches;
export function imageGhost(
  source: string,
  rect: CoverRect,
  parent: HTMLElement,
) {
  const image = document.createElement("img");
  image.className = "image-transition " + cx("transitionCover");
  image.src = source;
  image.alt = "";
  image.draggable = false;
  Object.assign(image.style, {
    left: rect.left + "px",
    top: rect.top + "px",
    width: rect.width + "px",
    height: rect.height + "px",
    zIndex: "101",
  });
  parent.append(image);
  return image;
}
export async function moveImage(
  image: HTMLImageElement,
  from: CoverRect,
  to: CoverRect,
  duration = 460,
) {
  if (reducedMotion()) return;
  const scale = to.width / from.width;
  if (!Number.isFinite(scale) || scale <= 0) return;
  await image
    .animate(
      [
        { transform: "none" },
        {
          transform: `translate(${to.left - from.left}px,${to.top - from.top}px) scale(${scale})`,
        },
      ],
      { duration, easing: motion.ease, fill: "forwards" },
    )
    .finished.catch(() => {});
}
export function fitArtwork(aspect: number): CoverRect {
  const height = Math.min(innerHeight - 180, (innerWidth - 64) * aspect),
    width = height / aspect;
  return {
    left: (innerWidth - width) / 2,
    top: (innerHeight - height) / 2,
    width,
    height,
  };
}
