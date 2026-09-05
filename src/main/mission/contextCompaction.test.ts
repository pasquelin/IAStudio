import { describe, expect, it } from 'vitest'
import { isRecord } from '@shared/guards'
import { compactContextValue } from './contextCompaction'

describe('mission context compaction', () => {
  it('preserves small structures before compacting oversized collections', () => {
    const compacted = compactContextValue(
      {
        nodes: Array.from({ length: 200 }, (_, at) => ({ id: `node_${at}`, name: `Node ${at}` })),
        animation: {
          duration: 5_000_000,
          transitions: [{ id: 'transition_1', at: 0, kind: 'fade', duration: 1 }],
        },
      },
      2_000,
    )

    expect(compacted).toMatchObject({
      truncated: true,
      value: {
        animation: {
          duration: 5_000_000,
          transitions: [{ id: 'transition_1', at: 0, kind: 'fade', duration: 1 }],
        },
      },
    })
    expect(JSON.stringify(compacted.value).length).toBeLessThanOrEqual(2_000)
  })

  it('preserves escaped string values while compacting them', () => {
    const value = `quoted "path" \\ ${'x'.repeat(3_000)}`
    const compacted = compactContextValue({ value }, 2_000)

    expect(
      isRecord(compacted.value) && typeof compacted.value.value === 'string'
        ? compacted.value.value
        : '',
    ).toMatch(/^quoted "path" \\/)
    expect(JSON.stringify(compacted.value).length).toBeLessThanOrEqual(2_000)
  })
})
