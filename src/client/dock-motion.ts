import { cx } from "../styles/ui";
import { motion } from "../lib/motion";
const animations = new WeakMap<HTMLElement, Animation>();
function updateIndicator(dock: HTMLElement) {
  for (const group of dock.querySelectorAll<HTMLElement>(".view-switch")) {
    const active = group?.querySelector<HTMLElement>(
      '[aria-pressed="true"],.selected',
    );
    if (!active) continue;
    let indicator = group.querySelector<HTMLElement>(".dock-selection");
    if (!indicator) {
      indicator = document.createElement("span");
      indicator.className = "dock-selection " + cx("dockSelection");
      indicator.setAttribute("aria-hidden", "true");
      group.prepend(indicator);
    }
    indicator.style.width = active.offsetWidth + "px";
    indicator.style.transform = `translateX(${active.offsetLeft}px)`;
  }
}
/** Measure the current interpolated width so rapid reversals continue in place. */
export function changeDock(selector: string) {
  const dock = document.querySelector<HTMLElement>(selector);
  if (!dock) return () => {};
  const width = dock.getBoundingClientRect().width;
  animations.get(dock)?.cancel();
  dock.style.width = "";
  return () => {
    updateIndicator(dock);
    const target = dock.getBoundingClientRect().width;
    if (
      !width ||
      !target ||
      Math.abs(target - width) < 0.5 ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    dock.style.width = target + "px";
    const animation = dock.animate(
      [{ width: width + "px" }, { width: target + "px" }],
      { duration: 420, easing: motion.ease },
    );
    animations.set(dock, animation);
    void animation.finished
      .then(() => {
        if (animations.get(dock) === animation) {
          dock.style.width = "";
          animations.delete(dock);
        }
      })
      .catch(() => {});
  };
}
export function initDockMotion() {
  document
    .querySelectorAll<HTMLElement>(".dock,.reader-dock")
    .forEach((dock) => {
      updateIndicator(dock);
      for (const group of dock.querySelectorAll(".view-switch"))
        new ResizeObserver(() => updateIndicator(dock)).observe(group);
    });
}
