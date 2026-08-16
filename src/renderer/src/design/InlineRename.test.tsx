import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { InlineRename } from './InlineRename'

/**
 * How every list in the studio wires this field: the owner holds whether it is open, and a commit
 * closes it. That is what turns a commit nobody asked for into a field nobody can see.
 */
function Owner({ onCommit }: { onCommit: (name: string) => void }) {
  const [editing, setEditing] = useState(true)

  return (
    <div role="list">
      <div tabIndex={0}>
        {editing ? (
          <InlineRename
            value="Summer"
            label="Rename"
            onCommit={name => {
              setEditing(false)
              onCommit(name)
            }}
          />
        ) : (
          'Summer'
        )}
      </div>
    </div>
  )
}

/**
 * StrictMode is the subject of this suite, not a detail of its setup: the window runs under it
 * (`main.tsx`) and `render` does not, which is why every suite in the studio watched this field
 * work while no rename in the running app did.
 */
describe('a name edited where it is read', () => {
  /**
   * The defect, measured over CDP in Electron on 13 August: StrictMode replays mount → cleanup →
   * mount, the cleanup handed the focus back to the row, `onBlur` read that as a commit, and the
   * owner closed a field that had been on screen for one frame. Double-click, menu row, every
   * caller — all of them looked like a gesture that did nothing.
   */
  it('stays open and focused under StrictMode, having committed nothing', () => {
    const onCommit = vi.fn()

    render(<Owner onCommit={onCommit} />, { wrapper: StrictMode })

    expect(screen.getByRole('textbox', { name: 'Rename' })).toHaveFocus()
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('commits the typed name on Enter', async () => {
    const onCommit = vi.fn()
    render(<Owner onCommit={onCommit} />, { wrapper: StrictMode })

    await userEvent.clear(screen.getByRole('textbox', { name: 'Rename' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Rename' }), 'Winter{Enter}')

    expect(onCommit).toHaveBeenCalledExactlyOnceWith('Winter')
  })

  /**
   * Typed through an input method, Enter picks the candidate character rather than ending the
   * name — a Japanese layer name committed on the first Enter would keep whatever syllable was
   * on screen at the time. `fireEvent` rather than `userEvent` because the composition flag lives
   * on the native event, which only a raw event carries.
   */
  it('leaves Enter to the input method while it is composing a character', () => {
    const onCommit = vi.fn()
    render(<Owner onCommit={onCommit} />, { wrapper: StrictMode })

    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Rename' }), {
      key: 'Enter',
      isComposing: true,
    })

    expect(onCommit).not.toHaveBeenCalled()
  })

  /**
   * Why the cleanup reaches for the focus at all, and what the guard must not cost: a field torn
   * out of the tree leaves the focus on `document.body`, so the next Tab restarts from the top of
   * the window and whoever renamed at the keyboard is thrown out of the list they were editing.
   */
  it('gives the focus back to the row it opened on when it really closes', async () => {
    render(<Owner onCommit={vi.fn()} />, { wrapper: StrictMode })

    await userEvent.type(screen.getByRole('textbox', { name: 'Rename' }), '{Escape}')

    expect(screen.getByText('Summer')).toHaveFocus()
  })
})
