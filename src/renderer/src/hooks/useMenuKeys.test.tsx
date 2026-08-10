import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useMenuKeys } from './useMenuKeys'

type MenuProps = {
  labels?: readonly string[]
  disabled?: readonly string[]
  onClose?: () => void
}

function Menu({ labels = ['Cut', 'Copy', 'Paste'], disabled = [], onClose = vi.fn() }: MenuProps) {
  const surface = useRef<HTMLDivElement | null>(null)
  useMenuKeys(surface, onClose)

  return (
    <div ref={surface} role="menu">
      {labels.map(label => (
        <button key={label} type="button" role="menuitem" disabled={disabled.includes(label)}>
          {label}
        </button>
      ))}
    </div>
  )
}

const row = (name: string): HTMLElement => screen.getByRole('menuitem', { name })

describe('the keyboard manners of a menu', () => {
  // A menu that portals to the end of `body` and leaves focus where it was is a menu reachable
  // only by tabbing through the whole document.
  it('puts focus on the first row as it opens', () => {
    render(<Menu />)

    expect(row('Cut')).toHaveFocus()
  })

  it('walks down and up, and wraps at both ends', async () => {
    render(<Menu />)

    await userEvent.keyboard('{ArrowDown}')
    expect(row('Copy')).toHaveFocus()

    await userEvent.keyboard('{ArrowDown}{ArrowDown}')
    expect(row('Cut')).toHaveFocus()

    await userEvent.keyboard('{ArrowUp}')
    expect(row('Paste')).toHaveFocus()
  })

  it('jumps to either end', async () => {
    render(<Menu />)

    await userEvent.keyboard('{End}')
    expect(row('Paste')).toHaveFocus()

    await userEvent.keyboard('{Home}')
    expect(row('Cut')).toHaveFocus()
  })

  // A disabled row is not something the pointer can choose either, and stopping on one is a
  // walk that looks broken.
  it('steps over a row that cannot be chosen', async () => {
    render(<Menu disabled={['Copy']} />)

    await userEvent.keyboard('{ArrowDown}')

    expect(row('Paste')).toHaveFocus()
  })

  it('opens on the first row that can be chosen', () => {
    render(<Menu disabled={['Cut']} />)

    expect(row('Copy')).toHaveFocus()
  })

  // One stop in the tab sequence, not one per row: the walk is the arrows' business.
  it('keeps a single row in the tab sequence, and moves it with the focus', async () => {
    render(<Menu />)

    expect(row('Cut').tabIndex).toBe(0)
    expect(row('Copy').tabIndex).toBe(-1)

    await userEvent.keyboard('{ArrowDown}')

    expect(row('Cut').tabIndex).toBe(-1)
    expect(row('Copy').tabIndex).toBe(0)
  })

  // The pattern APG names. The alternative is a trap nobody can leave without guessing.
  it('closes on Tab rather than walking out of itself', async () => {
    const onClose = vi.fn()
    render(<Menu onClose={onClose} />)

    await userEvent.keyboard('{Tab}')

    expect(onClose).toHaveBeenCalled()
  })

  it('gives focus back to what opened it', async () => {
    function Host() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open
          </button>
          {open && <Menu onClose={() => setOpen(false)} />}
        </>
      )
    }

    render(<Host />)
    const opener = screen.getByRole('button', { name: 'Open' })
    await userEvent.click(opener)
    expect(row('Cut')).toHaveFocus()

    await userEvent.keyboard('{Tab}')

    expect(opener).toHaveFocus()
  })

  /**
   * Closed by a press somewhere else, focus belongs to whatever was pressed — pulling it back
   * to the opener would undo the very gesture that closed the menu.
   */
  it('leaves focus alone when it closed because something else took it', async () => {
    function Host() {
      const [open, setOpen] = useState(true)
      return (
        <>
          <button type="button" onClick={() => setOpen(false)}>
            Elsewhere
          </button>
          {open && <Menu />}
        </>
      )
    }

    render(<Host />)
    const elsewhere = screen.getByRole('button', { name: 'Elsewhere' })

    await userEvent.click(elsewhere)

    expect(elsewhere).toHaveFocus()
  })

  // Every caller passes an inline arrow, so a dependency on it would tear the effect down on
  // each render of the parent — and drop focus back on the first row, mid-walk.
  it('does not restart the walk when its host renders again', async () => {
    function Host() {
      const [count, setCount] = useState(0)
      return (
        <>
          <button type="button" onClick={() => setCount(count + 1)}>
            Bump {count}
          </button>
          <Menu onClose={() => undefined} />
        </>
      )
    }

    render(<Host />)
    await userEvent.keyboard('{ArrowDown}')
    expect(row('Copy')).toHaveFocus()

    // `fireEvent`, not `userEvent`: a real click would take the focus itself, and the test would
    // then prove nothing about the effect — the walk would stop for that reason instead.
    fireEvent.click(screen.getByRole('button', { name: /Bump/ }))

    expect(row('Copy')).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    expect(row('Paste')).toHaveFocus()
  })

  it('says nothing and breaks nothing on a menu whose every row is disabled', async () => {
    render(<Menu disabled={['Cut', 'Copy', 'Paste']} />)

    await userEvent.keyboard('{ArrowDown}')

    expect(document.body).toHaveFocus()
  })
})
