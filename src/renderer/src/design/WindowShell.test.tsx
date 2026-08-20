import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { HINT_RIGHT } from '@/helpers/tooltip'
import { WINDOW_SOURCES } from '@/windowSources'
import { WindowShell } from './WindowShell'

describe('WindowShell', () => {
  it('frames a title, a named column and a pane', () => {
    render(
      <WindowShell title="Titre" navLabel="Colonne" nav={<button type="button">Un</button>}>
        <p>Le contenu</p>
      </WindowShell>,
    )

    expect(screen.getByRole('navigation', { name: 'Colonne' })).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveTextContent('Le contenu')
    expect(screen.getByRole('button', { name: 'Un' })).toBeInTheDocument()
  })

  // The five windows drew their title as bare words, so a reader was told nothing about which
  // window it had landed in. The licences window was the one that still had its own heading.
  it('names the window with a heading rather than bare words', () => {
    render(
      <WindowShell title="Titre">
        <p>Le contenu</p>
      </WindowShell>,
    )

    expect(screen.getByRole('heading', { level: 1, name: 'Titre' })).toBeInTheDocument()
  })

  /**
   * A window that reads as ONE block asks for no column, and an empty one is not the same thing:
   * 224 px of nothing down the left edge is what the file information window looked like before
   * the box was allowed to be absent.
   */
  it('leaves out the column entirely rather than framing an empty one', () => {
    render(
      <WindowShell title="Titre">
        <p>Le contenu</p>
      </WindowShell>,
    )

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveTextContent('Le contenu')
  })

  /**
   * The one thing a window cannot be trusted to remember. `<Tooltip>` is mounted per window, and
   * a window without it writes tooltip attributes nobody ever sees — silently, since a closed
   * tooltip renders nothing either way.
   */
  it('mounts the tooltip host, so a window never has to remember to', async () => {
    render(
      <WindowShell
        title="Titre"
        navLabel="Colonne"
        nav={
          <button type="button" {...HINT_RIGHT('Ce que fait ce bouton')}>
            Un
          </button>
        }
      >
        <p>Rien</p>
      </WindowShell>,
    )
    const entry = screen.getByRole('button', { name: 'Un' })

    // A closed tooltip renders nothing at all, so hovering is the only assertion that says the
    // host is there — the same way `LicencesWindow.test.tsx` proves it for its own window.
    await userEvent.hover(entry)

    await waitFor(() => expect(entry).toHaveAttribute('aria-describedby'))
  })
})

/**
 * That the frame stays written once.
 *
 * Settings and Usage carried the same header, the same `w-56` bordered column and the same
 * `min-w-0 flex-1 overflow-auto` pane, in two copies — `UsageWindow` said as much in its own
 * docstring — and the manual arrived as a third, in the studio's tokens rather than DaisyUI's.
 * Nothing caught it: three windows can each be green while looking like three applications.
 *
 * Read from source rather than rendered, because what is guarded is that the markup does not
 * EXIST elsewhere, which no render can show.
 */
describe('the frame of an application window', () => {
  const COLUMN = /className="[^"]*\bw-56\b[^"]*\bborder-r\b/
  const PANE = /<main[^>]*className="[^"]*min-w-0 flex-1 overflow-auto/

  it('is declared in one file, and every window borrows it', () => {
    const owners = Object.entries(WINDOW_SOURCES)
      .filter(([path]) => !path.endsWith('design/WindowShell.tsx'))
      .filter(([, code]) => COLUMN.test(code) || PANE.test(code))
      .map(([path]) => path)

    expect(owners).toEqual([])
  })
})
