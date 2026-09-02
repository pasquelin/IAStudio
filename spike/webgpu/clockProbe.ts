/**
 * La RÉSOLUTION que `performance.now()` offre vraiment, mesurée plutôt que supposée.
 *
 * Une page ordinaire est clampée à 100 µs : un critère à 0,05 ms y est du bruit. Isolée
 * cross-origin, Chromium rend ~5 µs. Ce banc ne conclut rien tant qu'il n'a pas dit lequel des
 * deux il a obtenu.
 */
export function clockResolution(): { isolated: boolean; smallestStepMs: number; samples: number } {
  const steps: number[] = []
  for (let take = 0; take < 200_000; take += 1) {
    const before = performance.now()
    const after = performance.now()
    if (after > before) steps.push(after - before)
  }
  steps.sort((one, other) => one - other)
  return {
    isolated: globalThis.crossOriginIsolated === true,
    smallestStepMs: steps[0] ?? 0,
    samples: steps.length,
  }
}

export async function runClockProbe(): Promise<{ results: unknown[]; failures: unknown[] }> {
  return { results: [clockResolution()], failures: [] }
}
