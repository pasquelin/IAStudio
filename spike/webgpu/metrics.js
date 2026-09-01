/**
 * Ce qu'on garde d'une passe de mesure : chaque frame, pas une moyenne courante.
 * Une p99 ne se calcule pas en flux, et c'est elle qui dit si l'app saccade.
 */

/** Percentile par interpolation linéaire, sur un tableau DÉJÀ trié. */
export function percentile(sorted, share) {
  if (sorted.length === 0) return 0
  const rank = (sorted.length - 1) * share
  const low = Math.floor(rank)
  const high = Math.ceil(rank)
  if (low === high) return sorted[low]
  return sorted[low] + (sorted[high] - sorted[low]) * (rank - low)
}

export function summarise(samples) {
  const kept = samples.filter(value => Number.isFinite(value) && value >= 0)
  if (kept.length === 0) return null
  const sorted = [...kept].sort((one, other) => one - other)
  return {
    n: sorted.length,
    mean: round(sorted.reduce((sum, value) => sum + value, 0) / sorted.length),
    median: round(percentile(sorted, 0.5)),
    p95: round(percentile(sorted, 0.95)),
    p99: round(percentile(sorted, 0.99)),
    min: round(sorted[0]),
    max: round(sorted[sorted.length - 1]),
  }
}

const round = value => Math.round(value * 1000) / 1000

/** Le tas JS, quand Chromium le publie. Jamais la VRAM, qu'aucune API du web ne donne. */
export function heapBytes() {
  return performance.memory ? performance.memory.usedJSHeapSize : null
}

/**
 * Ce que le renderer compte lui-même. Les deux backends ne nomment pas pareil : WebGL publie
 * `calls`, WebGPU `drawCalls` — lire l'un des deux sans l'autre rend zéro sur la moitié du banc.
 */
export function rendererCounters(renderer) {
  const info = renderer.info ?? {}
  const render = info.render ?? {}
  return {
    drawCalls: render.drawCalls ?? render.calls ?? 0,
    triangles: render.triangles ?? 0,
    geometries: info.memory?.geometries ?? 0,
    textures: info.memory?.textures ?? 0,
    programs: info.programs?.length ?? null,
  }
}
