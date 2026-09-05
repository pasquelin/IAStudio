import { isRecord } from '@shared/guards'

export const serializedContextLength = (value: unknown): number =>
  JSON.stringify(value)?.length ?? 0

function compactArray(value: readonly unknown[], maximum: number): unknown {
  const items: unknown[] = []
  for (const item of value) {
    const full = { truncated: true, items: [...items, item] }
    if (serializedContextLength(full) <= maximum) {
      items.push(item)
      continue
    }
    const room = maximum - serializedContextLength({ truncated: true, items }) - 1
    const compact = compactContextValue(item, room)
    const candidate = { truncated: true, items: [...items, compact.value] }
    if (serializedContextLength(candidate) <= maximum) items.push(compact.value)
    break
  }
  return { truncated: true, items }
}

function compactRecord(value: Readonly<Record<string, unknown>>, maximum: number): unknown {
  const compacted: Record<string, unknown> = { truncated: true }
  const entries = Object.entries(value).sort(
    (left, right) => serializedContextLength(left[1]) - serializedContextLength(right[1]),
  )
  for (const [key, item] of entries) {
    const full = { ...compacted, [key]: item }
    if (serializedContextLength(full) <= maximum) {
      compacted[key] = item
      continue
    }
    const room = maximum - serializedContextLength({ ...compacted, [key]: null }) + 4
    const compact = compactContextValue(item, room)
    const candidate = { ...compacted, [key]: compact.value }
    if (serializedContextLength(candidate) <= maximum) compacted[key] = compact.value
  }
  return compacted
}

function compactString(value: string, maximum: number): string | null {
  let lower = 1
  let upper = value.length
  let preview: string | null = null
  while (lower <= upper) {
    const middle = Math.floor((lower + upper) / 2)
    const candidate = `${value.slice(0, Math.max(0, middle - 1))}…`
    if (serializedContextLength(candidate) <= maximum) {
      preview = candidate
      lower = middle + 1
    } else {
      upper = middle - 1
    }
  }
  return preview
}

export function compactContextValue(
  value: unknown,
  maximum: number,
): { value: unknown; truncated: boolean } {
  if (serializedContextLength(value) <= maximum) return { value, truncated: false }
  if (maximum < 4) return { value: null, truncated: true }
  if (Array.isArray(value)) return { value: compactArray(value, maximum), truncated: true }
  if (isRecord(value)) return { value: compactRecord(value, maximum), truncated: true }
  return {
    value: typeof value === 'string' ? compactString(value, maximum) : null,
    truncated: true,
  }
}
