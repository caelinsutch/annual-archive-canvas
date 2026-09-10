/** Shared timings for interruptible Web Animations and camera interpolation. */
export const motion = {
  layout: 520,
  loaderMinimum: 1100,
  loaderReveal: 820,
  loaderEnter: 580,
  loaderStagger: 55,
  loaderHold: 200,
  readerClose: 550,
  cover: 480,
  dismiss: 160,
  snapDelay: 250,
  ease: "cubic-bezier(.22,1,.36,1)",
  cameraEase: 0.11,
} as const;
