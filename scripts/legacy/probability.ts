/** Open interval (0,1), deterministic 32-bit PRNG. */
export function randomFromSeed(seed: number) {
  let state = seed >>> 0;
  return () => { state += 0x6D2B79F5; let t = state; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 + 0.5 / 4294967296; };
}
export const percent = (value: number) => `${(100 * value).toFixed(1)}%`;
export function empiricalQuantile(sorted: number[], allCount: number, p: number): number | null {
  return sorted[Math.max(0, Math.ceil(allCount * p) - 1)] ?? null;
}
