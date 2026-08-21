import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { JobTarget } from '@shared/domain/job'
import type { FieldDescriptor } from '@shared/domain/model'
import { installFakeBridge } from '@/services/fakeBridge'
import {
  ESTIMATE_DEBOUNCE_MS,
  ESTIMATE_MIN_INTERVAL_MS,
  resetCostBudget,
  useCostEstimate,
} from './useCostEstimate'

const PROMPT: FieldDescriptor = { key: 'prompt', label: 'Prompt', kind: 'text', required: true }

/** Types one character at a time at a given pace, letting the hook see each edit. */
async function typeAt(
  onValuesChange: (body: Record<string, unknown>) => void,
  text: string,
  msPerChar: number,
): Promise<void> {
  for (let index = 1; index <= text.length; index++) {
    act(() => onValuesChange({ prompt: text.slice(0, index) }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(msPerChar)
    })
  }
}

describe('what the form in front of the user would cost', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // The floor is shared by every form of the window, so it outlives a case unless it is reset.
    resetCostBudget()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  /**
   * A dry run creates nothing and spends no credit, but it is an API request all the same, and
   * the studio's own rate limit counts it. One estimate per pause, not one per letter.
   */
  it('asks once for a burst of edits, not once per keystroke', async () => {
    const estimateCost = vi.fn(() => Promise.resolve({ creativeUnits: 12 }))
    installFakeBridge({ provider: { estimateCost } })

    const { result } = renderHook(() => useCostEstimate('model_flux', [PROMPT]))

    act(() => {
      result.current.onValuesChange({ prompt: 'a' })
      result.current.onValuesChange({ prompt: 'a r' })
      result.current.onValuesChange({ prompt: 'a rock' })
    })
    expect(estimateCost).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(ESTIMATE_DEBOUNCE_MS)
    })

    expect(estimateCost).toHaveBeenCalledOnce()
    expect(estimateCost).toHaveBeenCalledWith({ id: 'model_flux' }, { prompt: 'a rock' })
    expect(result.current.note).toContain('12')
  })

  /**
   * The failure a plain debounce hides: typed slower than its own delay, every keystroke lands
   * in its own window and becomes a request. Forty-three for one prompt, measured — more a
   * minute than ordinary traffic is allowed in total. The floor is what bounds it.
   */
  it('stays bounded when the typing is slower than the pause it waits for', async () => {
    const estimateCost = vi.fn(() => Promise.resolve({ creativeUnits: 1 }))
    installFakeBridge({ provider: { estimateCost } })

    const { result } = renderHook(() => useCostEstimate('model_flux', [PROMPT]))

    const text = 'a mossy boulder in a clearing at dawn'
    await typeAt(result.current.onValuesChange, text, ESTIMATE_DEBOUNCE_MS + 50)

    // One per floor at worst, never one per letter.
    const worst = Math.ceil((text.length * (ESTIMATE_DEBOUNCE_MS + 50)) / ESTIMATE_MIN_INTERVAL_MS)
    expect(estimateCost.mock.calls.length).toBeLessThanOrEqual(worst + 1)
    expect(estimateCost.mock.calls.length).toBeLessThan(text.length)
  })

  /**
   * Two generator forms are on screen at once as soon as a panel is detached into a second
   * window. A floor kept per hook would let each spend the whole interactive share, and the poll
   * loop is sized against that share once: it is the one that would pay.
   */
  it('spends one share between two forms, not one each', async () => {
    const estimateCost = vi.fn(() => Promise.resolve({ creativeUnits: 1 }))
    installFakeBridge({ provider: { estimateCost } })

    const generator = renderHook(() => useCostEstimate('model_flux', [PROMPT]))
    const second = renderHook(() => useCostEstimate('model_sdxl', [PROMPT]))

    act(() => generator.result.current.onValuesChange({ prompt: 'a rock' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ESTIMATE_DEBOUNCE_MS)
    })
    expect(estimateCost).toHaveBeenCalledOnce()

    // The second form asks straight away; the floor is what must hold it back all the same.
    act(() => second.result.current.onValuesChange({ prompt: 'a boulder' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ESTIMATE_DEBOUNCE_MS)
    })
    expect(estimateCost).toHaveBeenCalledOnce()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(ESTIMATE_MIN_INTERVAL_MS)
    })
    expect(estimateCost).toHaveBeenCalledTimes(2)
  })

  // A body without what the model requires answers 400, never a price: it buys nothing.
  it('asks nothing while a required field is empty', async () => {
    const estimateCost = vi.fn(() => Promise.resolve(null))
    installFakeBridge({ provider: { estimateCost } })

    const { result } = renderHook(() => useCostEstimate('model_flux', [PROMPT]))

    act(() => result.current.onValuesChange({}))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ESTIMATE_MIN_INTERVAL_MS)
    })

    expect(estimateCost).not.toHaveBeenCalled()
  })

  // Deleting a word and typing it back must not buy the same answer twice.
  it('asks nothing for a body it has already priced', async () => {
    const estimateCost = vi.fn(() => Promise.resolve({ creativeUnits: 12 }))
    installFakeBridge({ provider: { estimateCost } })

    const { result } = renderHook(() => useCostEstimate('model_flux', [PROMPT]))

    act(() => result.current.onValuesChange({ prompt: 'a rock' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ESTIMATE_MIN_INTERVAL_MS)
    })

    act(() => result.current.onValuesChange({ prompt: 'a rock' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ESTIMATE_MIN_INTERVAL_MS)
    })

    expect(estimateCost).toHaveBeenCalledOnce()
  })

  /**
   * Answers come back out of order: a slider dragged twice can have its first, dearer estimate
   * land second and sit on the button, pricing a form the user has already moved past.
   */
  it('keeps the answer to the last question, whatever order they come back in', async () => {
    const estimateCost = vi.fn((_target: JobTarget, body: Record<string, unknown>) =>
      body.prompt === 'slow'
        ? new Promise<{ creativeUnits: number }>(resolve =>
            setTimeout(() => resolve({ creativeUnits: 99 }), 8_000),
          )
        : Promise.resolve({ creativeUnits: 3 }),
    )
    installFakeBridge({ provider: { estimateCost } })

    const { result } = renderHook(() => useCostEstimate('model_flux', [PROMPT]))

    act(() => result.current.onValuesChange({ prompt: 'slow' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ESTIMATE_MIN_INTERVAL_MS)
    })

    act(() => result.current.onValuesChange({ prompt: 'fast' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ESTIMATE_MIN_INTERVAL_MS)
    })
    expect(result.current.note).toContain('3')

    // The dearer, older answer now lands. It must not take the button back.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8_000)
    })

    expect(estimateCost).toHaveBeenCalledTimes(2)
    expect(result.current.note).toContain('3')
  })

  /**
   * The main process lets a real outage travel rather than swallow it, so the figure already on
   * the button has to go: it prices a form nobody could confirm.
   */
  it('drops the figure it was showing when the call fails', async () => {
    let answer = (): Promise<{ creativeUnits: number }> => Promise.resolve({ creativeUnits: 12 })
    installFakeBridge({ provider: { estimateCost: () => answer() } })

    const { result } = renderHook(() => useCostEstimate('model_flux', [PROMPT]))

    act(() => result.current.onValuesChange({ prompt: 'a rock' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ESTIMATE_MIN_INTERVAL_MS)
    })
    expect(result.current.note).toContain('12')

    answer = () => Promise.reject(new Error('offline'))
    act(() => result.current.onValuesChange({ prompt: 'a boulder' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ESTIMATE_MIN_INTERVAL_MS)
    })

    expect(result.current.note).toBeUndefined()
  })

  /**
   * Two models can price the same form very differently. Left alone, the figure of the one
   * before stays on the button — and if their bodies serialise alike, the dedupe keeps it there.
   */
  it('drops the figure, and the memory of it, when the model changes', async () => {
    const estimateCost = vi.fn((target: JobTarget) =>
      Promise.resolve({ creativeUnits: target.id === 'model_flux' ? 12 : 99 }),
    )
    installFakeBridge({ provider: { estimateCost } })

    const { result, rerender } = renderHook(({ id }) => useCostEstimate(id, [PROMPT]), {
      initialProps: { id: 'model_flux' },
    })

    act(() => result.current.onValuesChange({ prompt: 'a rock' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ESTIMATE_MIN_INTERVAL_MS)
    })
    expect(result.current.note).toContain('12')

    rerender({ id: 'model_veo' })
    expect(result.current.note).toBeUndefined()

    // The very same body, which the dedupe would otherwise recognise and skip.
    act(() => result.current.onValuesChange({ prompt: 'a rock' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ESTIMATE_MIN_INTERVAL_MS)
    })

    expect(result.current.note).toContain('99')
  })

  /**
   * Answers come back seconds later. Left in flight, the price of the model before lands on the
   * button of the one now chosen — which was never estimated — and stays there.
   */
  it('drops an answer still in flight when the target changes', async () => {
    let land = (_estimate: { creativeUnits: number }): void => {}
    const estimateCost = vi.fn(
      () => new Promise<{ creativeUnits: number }>(resolve => (land = resolve)),
    )
    installFakeBridge({ provider: { estimateCost } })

    const { result, rerender } = renderHook(({ id }) => useCostEstimate(id, [PROMPT]), {
      initialProps: { id: 'model_flux' },
    })

    act(() => result.current.onValuesChange({ prompt: 'a rock' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ESTIMATE_MIN_INTERVAL_MS)
    })
    // The half that makes the assertion below mean anything: an answer really is in flight.
    expect(estimateCost).toHaveBeenCalledOnce()

    rerender({ id: 'model_veo' })
    await act(async () => {
      land({ creativeUnits: 12 })
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(result.current.note).toBeUndefined()
  })

  // The pause is worth an interactive request, and the form it was pricing is gone.
  it('drops a pause interrupted by a change of target', async () => {
    const estimateCost = vi.fn(() => Promise.resolve({ creativeUnits: 12 }))
    installFakeBridge({ provider: { estimateCost } })

    const { result, rerender } = renderHook(({ id }) => useCostEstimate(id, [PROMPT]), {
      initialProps: { id: 'model_flux' },
    })

    act(() => result.current.onValuesChange({ prompt: 'a rock' }))
    rerender({ id: 'model_veo' })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ESTIMATE_MIN_INTERVAL_MS)
    })

    expect(estimateCost).not.toHaveBeenCalled()
  })

  // A panel closed mid-pause must not spend a request on a form that is no longer on screen.
  it('asks nothing once the panel is gone', async () => {
    const estimateCost = vi.fn(() => Promise.resolve(null))
    installFakeBridge({ provider: { estimateCost } })

    const { result, unmount } = renderHook(() => useCostEstimate('model_flux', [PROMPT]))

    act(() => result.current.onValuesChange({ prompt: 'a rock' }))
    unmount()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ESTIMATE_MIN_INTERVAL_MS)
    })

    expect(estimateCost).not.toHaveBeenCalled()
  })
})
