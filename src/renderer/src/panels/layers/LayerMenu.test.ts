import i18next from 'i18next'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { groupLayer, pixelLayer, type Layer } from '@/engines/canvas/canvasState'
import { fakeMenu } from '@/helpers/menu-fixtures'
import { installFakeBridge } from '@/services/fakeBridge'
import { openLayerMenu } from './LayerMenu'

let menu = fakeMenu()
const run = vi.fn()
const onRename = vi.fn()

/** Raises the menu, since a native one leaves nothing on screen for a case to read. */
function raise(layer: Layer = pixelLayer('a', 'Sky'), canRemove = true): void {
  openLayerMenu({ layer, canRemove, t: i18next.t, onRename, run })
}

const offered = (pattern: RegExp): boolean | undefined => {
  const label = menu.labels().find(one => pattern.test(one))
  return label === undefined ? undefined : menu.offers(label)
}

describe('what the stack offers to do with a layer', () => {
  beforeEach(() => {
    menu = fakeMenu()
    run.mockClear()
    onRename.mockClear()
    installFakeBridge({ menu: menu.bridge })
  })

  it('offers the whole vocabulary of the stack in one press', () => {
    raise()

    expect(menu.labels()).toEqual([
      'Renommer le calque',
      'Dupliquer',
      'Grouper',
      'Dégrouper',
      'Supprimer le calque',
    ])
  })

  /**
   * `mergeDown` and `flatten` left the title bar for emptying the document from a button nobody
   * expected to. Their absence here is a decision, and this is what says so — bringing them back
   * reddens a case rather than passing unnoticed.
   */
  it('offers neither merging nor flattening', () => {
    raise()

    expect(menu.labels().some(label => /fusionner|aplatir/i.test(label))).toBe(false)
  })

  // Greyed rather than dropped: a menu whose length follows the selection cannot be learnt.
  it('shows ungrouping on a layer that is no group, and refuses it', () => {
    raise()

    expect(offered(/Dégrouper/)).toBe(false)
  })

  it('offers ungrouping on a group', () => {
    raise(groupLayer('g', 'Group', [pixelLayer('a', 'Sky')]))

    expect(offered(/Dégrouper/)).toBe(true)
  })

  // The command does not refuse it — `deserializeCanvas` rejects the empty stack that follows.
  it('refuses to delete the last paintable layer', () => {
    raise(pixelLayer('a', 'Sky'), false)

    expect(offered(/Supprimer/)).toBe(false)
  })

  it('deletes the layer the menu was raised on', async () => {
    menu.picks('Supprimer le calque')
    raise(pixelLayer('a', 'Sky'))

    await vi.waitFor(() => expect(run).toHaveBeenCalled())
    expect(run.mock.calls[0]?.[0]).toMatchObject({ id: 'layer:remove:a' })
  })

  // The rename is the row's own state — the menu asks for it rather than running a command.
  it('hands the rename back to the row instead of commanding it', async () => {
    menu.picks('Renommer le calque')
    raise()

    await vi.waitFor(() => expect(onRename).toHaveBeenCalled())
    expect(run).not.toHaveBeenCalled()
  })
})
