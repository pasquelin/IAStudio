import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { spellsOut, WRITTEN_SOURCES } from './testHarness'
import { WindowSearch } from './WindowSearch'

/** As `WRITTEN_SOURCES` keys it: the glob resolves against `testHarness.ts`, its own neighbour. */
const GUARDED = './WindowSearch.tsx'

/** The field written out by hand, whatever the order — the formatter sorts the words stably. */
const spellsOutField = spellsOut(['input', 'input-xs', 'w-full', 'shrink-0'])

describe('WindowSearch', () => {
  /**
   * One word for the name and for the placeholder: a field whose placeholder says one thing and
   * whose accessible name says another is two labels for one control, and only one is read aloud.
   */
  it('is named by the same word that stands in it', () => {
    render(<WindowSearch label="Rechercher un réglage" value="" onChange={() => {}} />)

    const field = screen.getByRole('searchbox', { name: 'Rechercher un réglage' })
    expect(field).toHaveAttribute('placeholder', 'Rechercher un réglage')
  })

  it('hands over what was typed', async () => {
    const onChange = vi.fn()
    render(<WindowSearch label="Rechercher" value="" onChange={onChange} />)

    await userEvent.type(screen.getByRole('searchbox'), 'a')

    expect(onChange).toHaveBeenCalledWith('a')
  })

  it('is worn rather than written out again', () => {
    const offenders = WRITTEN_SOURCES.filter(
      ([path, source]) => path !== GUARDED && spellsOutField(source),
    ).map(([path]) => path)

    expect(offenders).toEqual([])
  })

  // The partner of the rule above: a rule nobody's code reaches is green on an empty studio.
  // Word bounds, not a substring: `SettingsWindowSearchResults` holds the name and is not a use.
  it('is worn by the two windows it was extracted from', () => {
    const wearing = WRITTEN_SOURCES.filter(
      ([path, source]) => path !== GUARDED && /\bWindowSearch\b/.test(source),
    ).map(([path]) => path)

    expect(wearing.sort()).toEqual([
      '../manual/ManualWindow/ManualWindow.tsx',
      '../settings/SettingsWindow/SettingsWindow.tsx',
    ])
  })
})
