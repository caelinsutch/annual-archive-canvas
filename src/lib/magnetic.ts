export function magneticOffset(
  x: number,
  y: number,
  rect: { left: number; top: number; width: number; height: number },
) {
  const dx = x - (rect.left + rect.width / 2),
    dy = y - (rect.top + rect.height / 2);
  const distance = Math.hypot(
    Math.max(0, Math.abs(dx) - rect.width / 2),
    Math.max(0, Math.abs(dy) - rect.height / 2),
  );
  const strength = Math.max(0, 1 - distance / 64) ** 2;
  return {
    x: Math.tanh(dx / 48) * 2.5 * strength,
    y: Math.tanh(dy / 32) * 2.5 * strength,
    strength,
  };
}
