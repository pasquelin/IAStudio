import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type { ActivityEntry } from '@shared/domain/activity'
import { useActivity } from '@/stores/activity'
import { ActivityList } from './ActivityList'

const entry = (overrides: Partial<ActivityEntry> = {}): ActivityEntry => ({
  id: 1,
  at: '2026-08-08T10:00:00.000Z',
  level: 'error',
  topic: 'library',
  messageKey: 'activity.pushFailed',
  params: { name: 'moss.png' },
  ...overrides,
})

beforeEach(() => {
  useActivity.setState({ entries: [], levels: [], topics: [], unread: [] })
})

describe('the journal, drawn', () => {
  // A selector deriving a fresh array is a new snapshot every render, which React answers with
  // another render — the panel threw "Maximum update depth exceeded" the moment it opened.
  it('renders its lines rather than looping on its own selector', () => {
    useActivity.setState({ entries: [entry()] })

    render(<ActivityList />)

    expect(screen.getByText(/moss\.png/)).toBeInTheDocument()
  })

  // Hours and minutes, not one or the other: the shape of the kept formatter was asserted
  // nowhere, so dropping half of it left every test green.
  it('stamps each line with the time of day', () => {
    useActivity.setState({ entries: [entry()] })

    render(<ActivityList />)

    expect(screen.getByText(/^\d{2}:\d{2}$/)).toBeInTheDocument()
  })

  /**
   * The half nobody could guess: an App produces what it produces whichever space launched it,
   * so a run started in Modelling can leave a picture in the Image shelf. The line stores ids
   * and says them in the language of the day — a name written at the time would have frozen.
   */
  it('names the shelves a generation landed in, in the language of the window', () => {
    useActivity.setState({
      entries: [
        entry({
          level: 'info',
          topic: 'generation',
          messageKey: 'activity.generatedInto',
          params: { count: 2, workspaces: ['image', '3d'] },
        }),
      ],
    })

    render(<ActivityList />)

    // "et", not a bare comma: the word between the last two belongs to the reader's language.
    expect(screen.getByText('2 assets générés dans Image et Modélisation')).toBeInTheDocument()
  })

  // An id nothing names is left as it is: a shelf missing from the sentence reads as a bug,
  // an untranslated one reads as a shelf.
  it('leaves an id it cannot name alone rather than dropping it', () => {
    useActivity.setState({
      entries: [
        entry({
          level: 'info',
          topic: 'generation',
          messageKey: 'activity.generatedInto',
          params: { count: 1, workspaces: ['nether'] },
        }),
      ],
    })

    render(<ActivityList />)

    expect(screen.getByText(/nether/)).toBeInTheDocument()
  })

  it('says so when there is nothing to report', () => {
    render(<ActivityList />)

    expect(screen.getByText('Rien à signaler.')).toBeInTheDocument()
  })

  it('distinguishes an empty journal from one its filters emptied', () => {
    useActivity.setState({ entries: [entry({ level: 'info' })], levels: ['error'] })

    render(<ActivityList />)

    expect(screen.getByText('Rien ne correspond à ce filtre.')).toBeInTheDocument()
  })

  it('shows the detail beside the message, which is what one is asked for', () => {
    useActivity.setState({ entries: [entry({ detail: 'HTTP 429' })] })

    render(<ActivityList />)

    expect(screen.getByText('HTTP 429')).toBeInTheDocument()
  })
})

describe('the filters of the journal', () => {
  // The French bundle joins the two with a no-break space, which eslint refuses as a literal —
  // named by code point here for the same reason `bundles.test.ts` names it.
  const menuFor = (family: string, choice: string) =>
    screen.getByRole('button', { name: `${family}\u00a0: ${choice}` })

  /**
   * Eleven chips over two rows took a third of the panel. Collapsed, the button has to keep
   * saying what its family is filtering on — a menu that hid the choice would have traded a
   * crowded journal for a silent one, which is the failure this lot exists to avoid.
   */
  it('says on the closed button what each family is filtering on', () => {
    useActivity.setState({ levels: ['error'], topics: [] })

    render(<ActivityList />)

    expect(menuFor('Niveau', 'Échec')).toBeInTheDocument()
    expect(menuFor('Sujet', 'Tout')).toBeInTheDocument()
  })

  /**
   * The one thing jsdom cannot see, asserted the only way it can be: `ToolButton` is square by
   * gauge, so a label handed to it without `w-auto` is clipped to a character or two — the panel
   * would gain its height back and lose the reading, which is the opposite of the point. The
   * review caught this on a suite that was fully green, because every other assertion here reads
   * `aria-label`, and an accessible name survives any amount of clipping.
   */
  it('gives the button back the width its label needs', () => {
    useActivity.setState({ levels: ['error'], topics: [] })

    render(<ActivityList />)

    expect(menuFor('Niveau', 'Échec')).toHaveClass('w-auto')
  })

  // jsdom lays nothing out, so the row is asserted where it is written — `min-w-0` with it,
  // since without it neither name truncates and the pair pushes past the panel.
  it('stands its two families on one row, each free to shrink', () => {
    render(<ActivityList />)

    const button = menuFor('Niveau', 'Tout')
    // `ToolButton` is `shrink-0`; `min-w-0` alone leaves that in place and the pair still
    // overflows. `cn` merges the pair down to the one that wins, so this reads the outcome.
    expect(button).toHaveClass('min-w-0', 'shrink')
    expect(button).not.toHaveClass('shrink-0')

    const row = button.closest('div.flex')
    expect(row).not.toHaveClass('flex-col')
    expect(row?.querySelectorAll('button')).toHaveLength(2)
  })

  // The summary is TEXT on the button, not only its accessible name: read by the eye, it is what
  // replaces the eleven chips.
  it('draws the choice, and does not merely name it', () => {
    useActivity.setState({ levels: ['error'], topics: [] })

    render(<ActivityList />)

    expect(menuFor('Niveau', 'Échec')).toHaveTextContent('Échec')
  })

  it('names every value it is narrowed to, not a count', () => {
    useActivity.setState({ levels: ['warn', 'error'] })

    render(<ActivityList />)

    expect(menuFor('Niveau', 'Avertissement ou Échec')).toBeInTheDocument()
  })

  /**
   * Nothing selected IS everything to `matchesActivity`, so the row that means "no narrowing"
   * has to read as ticked exactly then — a menu that showed it unticked would say the family
   * was filtering when it was not.
   */
  it('ticks "Tout" for the family that narrows nothing, and only that one', async () => {
    useActivity.setState({ levels: ['error'], topics: [] })
    render(<ActivityList />)

    await userEvent.click(menuFor('Niveau', 'Échec'))
    expect(screen.getByRole('menuitemcheckbox', { name: 'Tout' })).toHaveAttribute(
      'aria-checked',
      'false',
    )
    expect(screen.getByRole('menuitemcheckbox', { name: 'Échec' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  it('clears one family from its menu and leaves the other filtering', async () => {
    useActivity.setState({ levels: ['error'], topics: ['import'] })
    render(<ActivityList />)

    await userEvent.click(menuFor('Niveau', 'Échec'))
    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Tout' }))

    expect(useActivity.getState().levels).toEqual([])
    expect(useActivity.getState().topics).toEqual(['import'])
  })

  /**
   * The half the chips had and the menu nearly lost: unticking the last value narrowed to means
   * "stop narrowing", and `matchesActivity` reads an empty list as everything. Nothing exercised
   * the removal branch until the review asked for it — the one place an inverted filter would
   * have passed green.
   */
  it('un-narrows a family by unticking what it was narrowed to', async () => {
    useActivity.setState({ levels: ['error'], topics: [] })
    render(<ActivityList />)

    await userEvent.click(menuFor('Niveau', 'Échec'))
    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Échec' }))

    expect(useActivity.getState().levels).toEqual([])
  })

  // The subjects are the family with no glyph of its own, and no test opened their menu: a
  // missing `activity.topics.*` key would have shown its raw key to nobody watching.
  it('offers every subject by name, glyphless', async () => {
    render(<ActivityList />)

    await userEvent.click(menuFor('Sujet', 'Tout'))

    expect(screen.getByRole('menuitemcheckbox', { name: 'Import' })).toBeInTheDocument()
    expect(screen.getByRole('menuitemcheckbox', { name: 'Génération' })).toBeInTheDocument()
  })

  it('adds a value to what its family already narrows to', async () => {
    useActivity.setState({ levels: ['error'], topics: [] })
    render(<ActivityList />)

    await userEvent.click(menuFor('Niveau', 'Échec'))
    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Avertissement' }))

    expect(useActivity.getState().levels).toEqual(['error', 'warn'])
  })

  /**
   * The panel is the side that gained this: it drew its glyph without `shrink-0`, so a long
   * message squeezed it while the home's copy held its size.
   */
  it('keeps the level glyph at its size whatever the message is', () => {
    useActivity.setState({ entries: [entry()] })

    const { container } = render(<ActivityList />)

    expect(container.querySelector('svg.shrink-0')).not.toBeNull()
  })
})
