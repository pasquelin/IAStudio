import { act, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { McpState } from '@shared/ipc'
import { installFakeBridge } from '@/services/fakeBridge'
import { McpSettings } from './McpSettings'

describe('the way in, as the settings window shows it', () => {
  it('says nothing is listening while the door is shut', async () => {
    installFakeBridge()
    render(<McpSettings />)

    await waitFor(() => expect(screen.getByText(/rien n’écoute/)).toBeInTheDocument())
  })

  /** The port, so the person can see WHERE — and never the token, which no window holds. */
  it('names the port it is listening on', async () => {
    installFakeBridge({
      mcp: { state: () => Promise.resolve({ port: 54_321 }) },
    })
    render(<McpSettings />)

    await waitFor(() => expect(screen.getByText(/127\.0\.0\.1:54321/)).toBeInTheDocument())
  })

  /**
   * 🛑 Subscribed rather than re-read on the setting: the port is bound AFTER the setting that
   * asked for it has been broadcast, so a screen reading on that change reads the instant before
   * — and would say "nothing is listening" over a door that just opened.
   */
  it('follows the door settling, rather than the setting that asked for it', async () => {
    let announce: ((state: McpState) => void) | undefined
    installFakeBridge({
      mcp: {
        state: () => Promise.resolve({ port: null }),
        onState: (callback: (state: McpState) => void) => {
          announce = callback
          return () => {}
        },
      },
    })
    render(<McpSettings />)

    await waitFor(() => expect(screen.getByText(/rien n’écoute/)).toBeInTheDocument())
    act(() => announce?.({ port: 4_242 }))

    await waitFor(() => expect(screen.getByText(/127\.0\.0\.1:4242/)).toBeInTheDocument())
  })
})
