import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ContextMenuItem } from '@shared/domain/context-menu'
import { installFakeBridge } from '@/services/fake-bridge'
import { showContextMenu } from './context-menu'

afterEach(() => {
  vi.unstubAllGlobals()
})

/** A bridge whose menu answers with the row named, and remembers what it was asked to draw. */
function bridgeAnswering(chosen: string | null) {
  const raised: (readonly ContextMenuItem[])[] = []

  installFakeBridge({
    menu: {
      popup: items => {
        raised.push(items)
        return Promise.resolve(chosen)
      },
    },
  })

  return raised
}

describe('a menu the system draws for a window', () => {
  it('sends the rows as the window wrote them, explanation included', async () => {
    const raised = bridgeAnswering(null)

    await showContextMenu([
      { label: 'Renommer', tooltip: 'Change le nom du fichier sur le disque', onSelect: () => {} },
      {
        label: 'Mettre à la corbeille',
        tooltip: 'Rien n’est effacé tout de suite',
        disabled: true,
        onSelect: () => {},
      },
    ])

    expect(raised[0]).toEqual([
      {
        id: '0',
        label: 'Renommer',
        enabled: true,
        tooltip: 'Change le nom du fichier sur le disque',
      },
      {
        id: '1',
        label: 'Mettre à la corbeille',
        enabled: false,
        tooltip: 'Rien n’est effacé tout de suite',
      },
    ])
  })

  /**
   * The first row and not a later one, deliberately: its id is `'0'`, and a caller reading that
   * back as falsy would drop the choice for exactly the row a menu is opened on most.
   */
  it('runs the row that was chosen', async () => {
    bridgeAnswering('0')
    const renamed = vi.fn()

    await showContextMenu([
      { label: 'Renommer', tooltip: 'Change le nom', onSelect: renamed },
      { label: 'Mettre à la corbeille', tooltip: 'Rien n’est effacé', onSelect: () => {} },
    ])

    expect(renamed).toHaveBeenCalledOnce()
  })

  it('runs nothing when the menu is dismissed', async () => {
    bridgeAnswering(null)
    const renamed = vi.fn()

    await showContextMenu([{ label: 'Renommer', tooltip: 'Change le nom', onSelect: renamed }])

    expect(renamed).not.toHaveBeenCalled()
  })

  // No canvas under a test, so no glyph is drawn — and the menu is raised all the same rather
  // than not at all.
  it('raises the menu where no glyph can be drawn', async () => {
    const raised = bridgeAnswering(null)

    await showContextMenu([
      { label: 'Renommer', icon: 'M0 0h24v24H0z', tooltip: 'Change le nom', onSelect: () => {} },
    ])

    expect(raised[0]).toEqual([
      { id: '0', label: 'Renommer', enabled: true, tooltip: 'Change le nom' },
    ])
  })
})
