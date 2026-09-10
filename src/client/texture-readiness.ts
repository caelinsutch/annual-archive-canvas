export interface TextureCoverage {
  ready: number;
  total: number;
}
export const textureTarget = (total: number) =>
  Math.min(total, Math.max(12, Math.ceil(total * 0.85)));

/** Wait for a useful viewport, with a bounded fallback for unavailable sources. */
export async function waitForTextureCoverage(
  sample: () => TextureCoverage,
  nextFrame: () => Promise<void>,
  now: () => number = () => performance.now(),
  timeout = 8000,
) {
  const started = now();
  for (;;) {
    const coverage = sample();
    if (coverage.total > 0 && coverage.ready >= textureTarget(coverage.total))
      return { ...coverage, complete: true };
    if (now() - started >= timeout) return { ...coverage, complete: false };
    await nextFrame();
  }
}
