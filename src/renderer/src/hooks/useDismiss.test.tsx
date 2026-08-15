import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useCallback, useRef, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useDismiss } from './useDismiss'

function Panel({ onDismiss }: { onDismiss?: () => void }) {
  const panel = useRef<HTMLDivElement | null>(null)
  useDismiss(onDismiss, panel)

  return (
    <>
      <div ref={panel}>
        <button type="button">Inside</button>
      </div>
      <button type="button">Outside</button>
    </>
  )
}

describe('useDismiss', () => {
  it('dismisses on a press outside', async () => {
    const onDismiss = vi.fn()
    render(<Panel onDismiss={onDismiss} />)

    await userEvent.click(screen.getByRole('button', { name: 'Outside' }))

    expect(onDismiss).toHaveBeenCalled()
  })

  it('leaves a press inside alone, since it is a row being chosen', async () => {
    const onDismiss = vi.fn()
    render(<Panel onDismiss={onDismiss} />)

    await userEvent.click(screen.getByRole('button', { name: 'Inside' }))

    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('dismisses on Escape, without the pointer having to move', async () => {
    const onDismiss = vi.fn()
    render(<Panel onDismiss={onDismiss} />)

    await userEvent.keyboard('{Escape}')

    expect(onDismiss).toHaveBeenCalled()
  })

  /**
   * The assistant holds a text field inside its surface, and Escape is how an input method
   * cancels the character being composed. Dismissing on it would close the window under someone
   * writing Japanese — the keystroke never meant to leave.
   */
  it('leaves Escape to the input method while it is composing a character', () => {
    const onDismiss = vi.fn()
    render(<Panel onDismiss={onDismiss} />)

    fireEvent.keyDown(document, { key: 'Escape', isComposing: true })

    expect(onDismiss).not.toHaveBeenCalled()
  })

  // In a studio one leaves for a reference image constantly, and a panel still hanging over the
  // canvas on the way back reads as a bug.
  it('dismisses when the window loses focus', () => {
    const onDismiss = vi.fn()
    render(<Panel onDismiss={onDismiss} />)

    window.dispatchEvent(new Event('blur'))

    expect(onDismiss).toHaveBeenCalled()
  })

  it('wires nothing at all without a callback, so a hover surface is left to its grace period', async () => {
    render(<Panel />)

    await userEvent.click(screen.getByRole('button', { name: 'Outside' }))
    await userEvent.keyboard('{Escape}')

    expect(screen.getByRole('button', { name: 'Inside' })).toBeInTheDocument()
  })

  /**
   * The defect the capture phase exists for: a surface that survives until mouseup stays under
   * the pointer while what is behind it has already reacted to the press.
   */
  it('dismisses on the press rather than on the release', () => {
    const onDismiss = vi.fn()
    render(<Panel onDismiss={onDismiss} />)

    screen
      .getByRole('button', { name: 'Outside' })
      .dispatchEvent(new Event('pointerdown', { bubbles: true }))

    expect(onDismiss).toHaveBeenCalled()
  })
})

function Toggle() {
  const [open, setOpen] = useState(false)
  const panel = useRef<HTMLDivElement | null>(null)
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null)
  const close = useCallback(() => setOpen(false), [])

  useDismiss(open ? close : undefined, panel, anchor)

  return (
    <>
      <button ref={setAnchor} type="button" onClick={() => setOpen(current => !current)}>
        Journal
      </button>
      {open && <div ref={panel}>Failures</div>}
    </>
  )
}

/**
 * The anchor has to count as inside. Left out, the press closes the panel and the click that
 * follows reopens it — a toggle that can be opened and never closed.
 */
describe('a toggle that dismisses itself', () => {
  it('closes on its own button rather than reopening under it', async () => {
    render(<Toggle />)
    const button = screen.getByRole('button', { name: 'Journal' })

    await userEvent.click(button)
    expect(screen.getByText('Failures')).toBeInTheDocument()

    await userEvent.click(button)

    expect(screen.queryByText('Failures')).not.toBeInTheDocument()
  })
})
