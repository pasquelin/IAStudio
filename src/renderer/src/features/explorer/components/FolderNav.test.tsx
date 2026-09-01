import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { FolderNav } from './FolderNav'

const nav = (props: Partial<Parameters<typeof FolderNav>[0]> = {}) => {
  const calls = { onBack: vi.fn(), onForward: vi.fn(), onUp: vi.fn() }
  render(<FolderNav canBack canForward canUp {...calls} {...props} />)
  const [back, forward, up] = screen.getAllByRole('button')

  return { back: back!, forward: forward!, up: up!, ...calls }
}

describe('the way back out of a folder', () => {
  it('walks back, forward and up on its three buttons', async () => {
    const { back, forward, up, onBack, onForward, onUp } = nav()

    await userEvent.click(back)
    await userEvent.click(forward)
    await userEvent.click(up)

    expect([onBack, onForward, onUp].map(call => call.mock.calls.length)).toEqual([1, 1, 1])
  })

  /** A button that answers nothing is worse than none: it says there is somewhere to go. */
  it('greys out what leads nowhere', () => {
    const { back, forward, up } = nav({ canBack: false, canForward: false, canUp: false })

    expect([back, forward, up].every(button => button.hasAttribute('disabled'))).toBe(true)
  })
})
