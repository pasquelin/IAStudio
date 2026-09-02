import { beforeEach, describe, expect, it } from 'vitest'
import { shownIn } from '@pasquelin/panels'
import { chassisFor } from '@/stores/panels-fixtures'
import { panelsStore } from '@/stores/panels'
import { useLayouts } from '@/stores/layouts'
import { useDocuments } from '@/stores/documents'
import { installDocument } from '@/stores/document-fixtures'
import { revealAssets, revealTool } from './revealPanel'

beforeEach(() => {
  useLayouts.setState({ activeWorkspace: 'image', home: false })
  chassisFor('image')
})

/** What the zone DRAWS on the surface in front — never what the half merely holds. */
const drawn = (zone: Parameters<typeof shownIn>[1]) => shownIn(panelsStore.getState(), zone)

/**
 * The shelf is the upper left in every space, which it was not until 17 August — it lay in the
 * band or the right column depending on the space. A half whose placement does not match its
 * zone renders a different panel altogether, so opening it in the wrong one shows the layers
 * instead — and quietly rewrites the user's layout on the way.
 */
describe('revealing the shelf', () => {
  it('opens it in the upper left, leaving the other zones alone', () => {
    revealAssets()

    expect(drawn('left').primary).toBe('assets')
    // The other zones are as the studio opened them: revealing a panel moves ONE half.
    expect(drawn('bottomRight').primary).toBeUndefined()
    expect(drawn('right').primary).toBe('layers')
  })

  // It used to move with the space, and the test that said so is the one this replaces: the
  // shelf answers the same question everywhere, so it no longer changes corner on the way.
  it('opens it in the same half whatever the workspace', () => {
    useLayouts.setState({ activeWorkspace: 'video' })
    chassisFor('video')

    revealAssets()

    expect(drawn('left').primary).toBe('assets')
  })

  it('focuses the column rather than reopening it when it is already there', () => {
    chassisFor('image', { left: { primary: 'assets' } })

    revealAssets()

    expect(panelsStore.getState().focusedZone).toBe('left')
  })

  /**
   * A default layout IS rewritten now, and that is the change of moving in beside the models:
   * a half left on its default opens on the FIRST tool the registry declares there, which is
   * the models — so the shelf has to be named to come up, where the band used to show it
   * without anyone asking.
   */
  it('names the shelf in a default layout, the half being the generator until it does', () => {
    // A half left on its default draws the FIRST panel declared for it, which is the generator
    // — so the shelf has to be named to come up.
    chassisFor('image', { left: { primary: null } })
    expect(drawn('left').primary).toBe('generator')

    revealAssets()

    expect(panelsStore.getState().views.workspaces?.left?.primary).toBe('assets')
    expect(panelsStore.getState().focusedZone).toBe('left')
  })
})

/**
 * A panel is not reachable simply because the surface declares one somewhere: the assistant is
 * withheld while the empty centre stages the same conversation, and naming it in the half anyway
 * wrote a layout the reader never asked for — then resolved it away and opened the column on the
 * layers instead. Silently, since every gate is green on a store write nothing draws.
 */
describe('revealing a panel the surface is not offering', () => {
  it('refuses rather than writing it into the half', () => {
    useDocuments.setState({ documents: {}, activeId: null })
    chassisFor('image')

    expect(revealTool('assistant')).toBe(false)
    // The half keeps what the surface does declare, rather than a panel nobody can reach.
    expect(drawn('right').primary).toBe('layers')
  })

  it('opens it once a document holds the centre', () => {
    installDocument('doc-1', 'image')
    chassisFor('image')

    expect(revealTool('assistant')).toBe(true)
    expect(drawn('right').primary).toBe('assistant')
  })
})
