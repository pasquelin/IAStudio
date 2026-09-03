/** One order statistic without sorting the whole sample. */
export function quantile(values: readonly number[], at: number): number {
  if (values.length === 0) return 0

  const held = Float64Array.from(values)
  const rank = Math.min(held.length - 1, Math.floor(held.length * at))
  let from = 0
  let to = held.length - 1

  while (from < to) {
    const wall = partition(held, from, to)
    if (wall === rank) break
    if (wall < rank) from = wall + 1
    else to = wall - 1
  }

  return held[rank] ?? 0
}

function partition(held: Float64Array, from: number, to: number): number {
  const pivot = held[to] ?? 0
  let wall = from

  for (let at = from; at < to; at += 1) {
    if ((held[at] ?? 0) > pivot) continue

    const current = held[at] ?? 0
    held[at] = held[wall] ?? 0
    held[wall] = current
    wall += 1
  }

  const last = held[to] ?? 0
  held[to] = held[wall] ?? 0
  held[wall] = last
  return wall
}
