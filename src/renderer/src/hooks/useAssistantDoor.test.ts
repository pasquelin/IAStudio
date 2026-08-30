import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { aiOverview, roleRow } from '@shared/domain/aiOverview-fixtures'
import { ASSISTANT_ROLE } from '@shared/domain/aiRole'
import type { AssistantWindow } from '@shared/domain/assistant'
import { installFakeBridge } from '@/services/fakeBridge'
import { useAiModels } from '@/stores/aiModels'
import { useAssistant } from '@/stores/assistant'
import { useAssistantDoor } from './useAssistantDoor'

const CHARACTERS: AssistantWindow = { size: 100_000, unit: 'characters', assumed: false }

const served = (providerId: string | null): void => {
  useAiModels.setState({
    overview: aiOverview({
      roles: [
        roleRow({
          role: ASSISTANT_ROLE,
          provider: providerId === null ? null : { kind: 'cloud', providerId },
        }),
      ],
    }),
  })
}

beforeEach(() => {
  useAssistant.setState({ door: undefined })
  served('scenario')
})

describe('what the door in front says of its own bound', () => {
  it('asks it and hands it to the composer, before any turn has run', async () => {
    installFakeBridge({ assistant: { window: () => Promise.resolve(CHARACTERS) } })
    renderHook(() => useAssistantDoor())

    await waitFor(() => expect(useAssistant.getState().door).toEqual(CHARACTERS))
  })

  /** The bound belongs to the door, so another door answering is another bound to read. */
  it('asks again when another door takes over', async () => {
    const window = vi.fn(() => Promise.resolve(CHARACTERS))
    installFakeBridge({ assistant: { window } })
    const { rerender } = renderHook(() => useAssistantDoor())

    await waitFor(() => expect(window).toHaveBeenCalledTimes(1))
    served('anthropic')
    rerender()

    await waitFor(() => expect(window).toHaveBeenCalledTimes(2))
  })

  /**
   * 🛑 Nothing SERVES is not a door that names no window: announcing an unknown window for a door
   * that is not there reads as a limit nobody could find, rather than as nothing chosen yet.
   */
  it('asks nothing, and says nothing, while nothing serves the assistant', async () => {
    const window = vi.fn(() => Promise.resolve(CHARACTERS))
    installFakeBridge({ assistant: { window } })
    served(null)
    renderHook(() => useAssistantDoor())

    await waitFor(() => expect(useAssistant.getState().door).toBeUndefined())
    expect(window).not.toHaveBeenCalled()
  })

  // A door that cannot answer for its bound has an unknown window, never a ratio.
  it('reads a refusal as a window nobody knows', async () => {
    installFakeBridge({ assistant: { window: () => Promise.reject(new Error('no door')) } })
    renderHook(() => useAssistantDoor())

    await waitFor(() => expect(useAssistant.getState().door).toBeNull())
  })
})
