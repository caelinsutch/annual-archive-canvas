import { magneticOffset } from "../lib/magnetic";
/** Small proximity response, disabled for touch, keyboard focus and reduced motion. */
export function initMagneticControls() {
  const enabled = matchMedia(
    "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
  );
  let pending = 0,
    x = -10000,
    y = -10000;
  const offsets = new WeakMap<HTMLElement, { x: number; y: number }>();
  function reset() {
    for (const button of document.querySelectorAll<HTMLElement>(
      ".glass-control",
    )) {
      button.style.translate = "";
      button.style.removeProperty("--proximity");
      offsets.delete(button);
    }
  }
  function paint() {
    pending = 0;
    if (!enabled.matches) {
      reset();
      return;
    }
    const modal =
      document.activeElement?.closest("dialog[open]") ||
      [...document.querySelectorAll("dialog[open]")].at(-1);
    const updates = [];
    for (const button of document.querySelectorAll<HTMLButtonElement>(
      ".glass-control",
    )) {
      if (
        button.disabled ||
        button.matches(":focus-visible") ||
        (modal && !modal.contains(button))
      )
        continue;
      const rect = button.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      const translated = getComputedStyle(button)
        .translate.split(" ")
        .map((value) => parseFloat(value) || 0);
      const prior = { x: translated[0] || 0, y: translated[1] || 0 };
      const left = rect.left - prior.x,
        top = rect.top - prior.y;
      updates.push({
        button,
        value: magneticOffset(x, y, {
          left,
          top,
          width: rect.width,
          height: rect.height,
        }),
        localX: x - left,
        localY: y - top,
      });
    }
    for (const { button, value, localX, localY } of updates) {
      offsets.set(button, value);
      button.style.translate = `${value.x.toFixed(2)}px ${value.y.toFixed(2)}px`;
      button.style.setProperty("--proximity", value.strength.toFixed(3));
      button.style.setProperty("--pointer-x", localX + "px");
      button.style.setProperty("--pointer-y", localY + "px");
    }
  }
  document.addEventListener(
    "pointermove",
    (event) => {
      if (event.pointerType !== "mouse") return;
      x = event.clientX;
      y = event.clientY;
      if (!pending) pending = requestAnimationFrame(paint);
    },
    { passive: true },
  );
  document.addEventListener("pointerleave", reset);
  document.addEventListener("keydown", reset);
  document.addEventListener("focusin", reset);
  document.addEventListener("pointerdown", reset);
  window.addEventListener("blur", reset);
  enabled.addEventListener("change", reset);
}
