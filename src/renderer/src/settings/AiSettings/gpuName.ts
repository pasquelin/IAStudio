/**
 * The chip, out of what the probe could read. Chromium answers
 * `ANGLE (Apple, ANGLE Metal Renderer: Apple M2 Max, Version 26.5.2 (Build 25F84))` — measured on
 * this Mac, 2026-08-21 — and a line of a settings screen has no room for the build of a driver.
 */
export function gpuName(renderer: string): string {
  const named = /:\s*([^,)]+)/.exec(renderer)

  return renderer.startsWith('ANGLE (') && named?.[1] ? named[1].trim() : renderer
}
