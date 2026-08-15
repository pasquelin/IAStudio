import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { installFakeBridge } from '@/services/fake-bridge'
import { ManualWindow } from './ManualWindow'

// Nineteen chapters of prose land in the DOM on every render, and `userEvent` re-checks
// pointability against all of it. Slow for the reason the window exists.
vi.setConfig({ testTimeout: 20_000 })

/**
 * Scoped to the list, and it has to be: chapters name each other in their prose, so
 * "Premiers pas" is both a row of the sidebar and a link inside chapter 1.
 */
const pick = (name: RegExp) =>
  userEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name }))

describe('ManualWindow', () => {
  beforeEach(() => {
    installFakeBridge()
  })

  it('lists every chapter and opens on the first', () => {
    render(<ManualWindow />)
    const list = within(screen.getByRole('navigation'))

    expect(list.getByRole('button', { name: /Découvrir le studio/ })).toBeInTheDocument()
    expect(list.getByRole('button', { name: /Comment faire pour/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Découvrir le studio/ })).toBeInTheDocument()
  })

  it('shows the chapter picked from the list', async () => {
    render(<ManualWindow />)

    await pick(/Espace Audio/)

    expect(screen.getByRole('heading', { name: /^Le montage$/ })).toBeInTheDocument()
  })

  /**
   * The reason the manual is compiled rather than fetched: a chapter reference inside the prose
   * is a live move, not a `.md` path that a browserless window would do nothing with.
   */
  it('follows a link written in the prose to the chapter it names', async () => {
    render(<ManualWindow />)
    await pick(/Espace Audio/)

    const article = within(screen.getByRole('article'))
    await userEvent.click(article.getByRole('button', { name: 'Espace Vidéo' }))

    expect(screen.getByRole('heading', { name: /Le vocabulaire du montage/ })).toBeInTheDocument()
  })

  // The anchor a link lands on has to be the id the heading carries: both come from
  // `manualAnchorOf`, and this is what says so on rendered output rather than in a comment.
  it('gives every heading the anchor its own links point at', async () => {
    render(<ManualWindow />)
    await pick(/Espace Audio/)

    expect(screen.getByRole('heading', { name: /^Le montage$/ })).toHaveAttribute(
      'id',
      'le-montage',
    )
  })

  // Over the prose, not over the titles: no chapter is called "dé-esseur", and the two that
  // explain why the studio has none are exactly what a reader typing it is after.
  it('narrows the chapter list to what the search words appear in', async () => {
    render(<ManualWindow />)

    await userEvent.type(screen.getByRole('searchbox'), 'dé-esseur')

    const list = within(screen.getByRole('navigation'))

    expect(list.getByRole('button', { name: /Espace Audio/ })).toBeInTheDocument()
    expect(list.queryByRole('button', { name: /Glossaire/ })).not.toBeInTheDocument()
  })

  // A search box that demands a circumflex is a search box nobody uses — `foldForSearch` is
  // what the settings search settled this with, and the manual takes the same one.
  it('finds an accented word typed without its accents', async () => {
    render(<ManualWindow />)

    await userEvent.type(screen.getByRole('searchbox'), 'de-esseur')

    expect(
      within(screen.getByRole('navigation')).getByRole('button', { name: /Espace Audio/ }),
    ).toBeInTheDocument()
  })

  it('says so when nothing matches', async () => {
    render(<ManualWindow />)

    await userEvent.type(screen.getByRole('searchbox'), 'zzzznothing')

    expect(screen.getByText('Aucun chapitre ne contient ces mots.')).toBeInTheDocument()
  })

  /**
   * An outward link leaves through `setWindowOpenHandler`, which refuses anything but HTTPS.
   * `target="_blank"` is what routes it there — without it the click navigates the window, and
   * `lockNavigation` cancels it, which reads as a dead link.
   */
  it('sends an outward link to the system browser rather than navigating', async () => {
    render(<ManualWindow />)
    await pick(/Premiers pas/)

    const outward = within(screen.getByRole('article')).getAllByRole('link').at(0)

    expect(outward).toHaveAttribute('target', '_blank')
    expect(outward?.getAttribute('href')).toMatch(/^https:\/\//)
  })
})
