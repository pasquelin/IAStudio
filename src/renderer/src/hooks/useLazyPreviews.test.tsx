import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MODEL_IDS_BATCH_LIMIT, type ModelSummary } from '@shared/domain/model'
import { useLazyPreviews } from './useLazyPreviews'

const asked: string[] = []
const answers: Record<string, string> = {}

vi.mock('@/services/bridge', () => ({
  getBridge: () => ({
    provider: {
      modelPreviews: (assetIds: readonly string[]) => {
        asked.push(...assetIds)
        return Promise.resolve(
          Object.fromEntries(assetIds.filter(id => answers[id]).map(id => [id, answers[id]])),
        )
      },
    },
  }),
}))

const model = (id: string, over: Partial<ModelSummary> = {}): ModelSummary => ({
  id,
  name: id,
  family: 'image',
  runsOn: 'scenario',
  source: 'scenario',
  origin: 'community',
  featured: false,
  capabilities: ['txt2img'],
  tags: [],
  previewAssetId: `asset_${id}`,
  ...over,
})

beforeEach(() => {
  asked.length = 0
  for (const key of Object.keys(answers)) delete answers[key]
  vi.useFakeTimers()
})

afterEach(() => vi.useRealTimers())

describe('the pictures a list needs', () => {
  /**
   * 🛑 The remainder used to be kept back "for the next window", and no such window was ever
   * armed: past the cap the ids sat asked-for and unasked, and those cards kept an empty plate.
   */
  it('asks for every one it was given, past the cap the channel sets', () => {
    const many = Array.from({ length: MODEL_IDS_BATCH_LIMIT + 30 }, (_, at) => model(`m${at}`))
    const { result } = renderHook(() => useLazyPreviews())

    act(() => result.current.resolveFor(many))
    act(() => void vi.advanceTimersByTime(500))

    expect(asked).toHaveLength(many.length)
  })

  // A model carrying its own thumbnail costs no round trip: the picture is already in the listing.
  it('leaves alone what already carries its picture', () => {
    const held = model('a', { thumbnail: 'https://held/a.png' })
    const { result } = renderHook(() => useLazyPreviews())

    act(() => result.current.resolveFor([held]))
    act(() => void vi.advanceTimersByTime(500))

    expect(asked).toEqual([])
    expect(result.current.pictureOf(held)).toBe('https://held/a.png')
  })
})
