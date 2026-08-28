import { beforeEach, describe, expect, it } from 'vitest'
import { arrangedFor } from '@/stores/tool-fixtures'
import { DEFAULT_ARRANGEMENTS, DEFAULT_OPEN, arrangementOf, useTools } from '@/stores/tools'
import { useLayouts } from '@/stores/layouts'
import { useDocuments } from '@/stores/documents'
import { installDocument } from '@/stores/document-fixtures'
import { revealAssets, revealTool } from './revealPanel'

beforeEach(() => {
  useTools.setState({ arrangements: arrangedFor('image', { open: {} }), focusedZone: null })
  useLayouts.setState({ activeWorkspace: 'image', home: false })
})

/**
 * The shelf is the upper left in every space, which it was not until 17 August — it lay in the
 * band or the right column depending on the space. A half whose placement does not match its
 * zone renders a different panel altogether, so opening it in the wrong one shows the layers
 * instead — and quietly rewrites the user's layout on the way.
 */
describe('revealing the shelf', () => {
  it('opens it in the upper left, leaving the other zones alone', () => {
    revealAssets()

    expect(arrangementOf(useTools.getState(), 'image').open.left?.primary).toBe('assets')
    expect(arrangementOf(useTools.getState(), 'image').open.bottomRight).toBeUndefined()
    expect(arrangementOf(useTools.getState(), 'image').open.right).toBeUndefined()
  })

  // It used to move with the space, and the test that said so is the one this replaces: the
  // shelf answers the same question everywhere, so it no longer changes corner on the way.
  it('opens it in the same half whatever the workspace', () => {
    useLayouts.setState({ activeWorkspace: 'video' })

    revealAssets()

    expect(arrangementOf(useTools.getState(), 'image').open.left?.primary).toBe('assets')
  })

  it('focuses the column rather than reopening it when it is already there', () => {
    useTools.setState({
      arrangements: arrangedFor('image', { open: { left: { primary: 'assets' } } }),
    })

    revealAssets()

    expect(useTools.getState().focusedZone).toBe('left')
  })

  /**
   * A default layout IS rewritten now, and that is the change of moving in beside the models:
   * a half left on its default opens on the FIRST tool the registry declares there, which is
   * the models — so the shelf has to be named to come up, where the band used to show it
   * without anyone asking.
   */
  it('names the shelf in a default layout, the half being the models until it does', () => {
    useTools.setState({ arrangements: DEFAULT_ARRANGEMENTS })

    revealAssets()

    expect(arrangementOf(useTools.getState(), 'image').open).not.toEqual(DEFAULT_OPEN.workspaces)
    expect(arrangementOf(useTools.getState(), 'image').open.left?.primary).toBe('assets')
    expect(useTools.getState().focusedZone).toBe('left')
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

    expect(revealTool('assistant')).toBe(false)
    expect(arrangementOf(useTools.getState(), 'image').open.right).toBeUndefined()
  })

  it('opens it once a document holds the centre', () => {
    installDocument('doc-1', 'image')

    expect(revealTool('assistant')).toBe(true)
    expect(arrangementOf(useTools.getState(), 'image').open.right?.primary).toBe('assistant')
  })
})
