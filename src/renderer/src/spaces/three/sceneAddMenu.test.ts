import i18next from 'i18next'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ContextMenuItem } from '@shared/domain/contextMenu'
import { ADD_FAMILIES } from '@/engines/scene/nodeKinds'
import { installFakeBridge } from '@/services/fakeBridge'
import { openSceneAddMenu } from './sceneAddMenu'

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

const opened = async (chosen: string | null, onAdd = vi.fn()) => {
  const raised = bridgeAnswering(chosen)
  openSceneAddMenu({ t: i18next.t, onAdd })
  // `showContextMenu` is awaited inside, so the row runs a microtask after the call.
  await vi.waitFor(() => expect(raised).toHaveLength(1))
  return { raised, onAdd }
}

describe('what a scene can receive', () => {
  /**
   * One row per family, each opening onto its own kinds — the cut the toolbar's three buttons
   * already make. Flat, this menu would be twenty-four rows of three different natures.
   */
  it('offers a row per family, and none of them flat', async () => {
    const { raised } = await opened(null)

    expect(raised[0]).toHaveLength(ADD_FAMILIES.length)
    for (const row of raised[0] ?? []) expect(row.submenu?.length).toBeGreaterThan(0)
  })

  // Read off the registry rather than named here, so a kind added to it arrives in this menu.
  it('offers every kind the registry declares, under its own family', async () => {
    const { raised } = await opened(null)

    expect(raised[0]?.flatMap(row => row.submenu ?? [])).toHaveLength(
      ADD_FAMILIES.flatMap(family => family.entries).length,
    )
  })

  it('names them rather than showing a key', async () => {
    const { raised } = await opened(null)

    expect(raised[0]?.[0]?.label).toBe('Ajouter une maille')
    expect(raised[0]?.[0]?.submenu?.[0]?.label).toBe('Cube')
  })

  it('adds the kind of the row chosen', async () => {
    const { onAdd } = await opened('0.0')

    expect(onAdd).toHaveBeenCalledWith(ADD_FAMILIES[0]?.entries[0]?.kind)
  })
})
