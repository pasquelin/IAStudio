import i18next from 'i18next'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setNodeVisible } from '@/engines/scene/commands'
import { EMPTY_SCENE } from '@/engines/scene/scene-state'
import { meshNode } from '@/engines/scene/scene-fixtures'
import { fakeMenu } from '@/helpers/menu-fixtures'
import { installFakeBridge } from '@/services/fake-bridge'
import { installScene, sceneNodeNow } from '@/stores/scene-fixtures'
import { sceneOf, useScenes } from '@/stores/scenes'
import { openSceneNodeMenu } from './SceneNodeMenu'

let menu = fakeMenu()

const scene = () => sceneOf(useScenes.getState(), 'doc-1')

/** Raises the menu, since a native one leaves nothing on screen for a case to read. */
function raise(nodeId: string, onRename?: () => void): void {
  openSceneNodeMenu({ documentId: 'doc-1', nodeId, t: i18next.t, onRename })
}

describe('what the 3D space offers to do with a node', () => {
  beforeEach(() => {
    menu = fakeMenu()
    installFakeBridge({ menu: menu.bridge })
    installScene('doc-1', {
      ...EMPTY_SCENE,
      nodes: [meshNode('box-1'), meshNode('box-2'), meshNode('box-3')],
    })
  })

  it('offers the whole vocabulary of the outliner in one press', () => {
    raise('box-1', vi.fn())

    expect(menu.labels()).toEqual([
      'Renommer l’objet',
      'Dupliquer',
      'Grouper',
      'Cadrer la sélection',
      'Masquer l’objet',
      'Supprimer',
    ])
  })

  // A viewport draws no name to type over, so the row that would open one has nowhere to land.
  it('drops the rename where nothing can open a name', () => {
    raise('box-1')

    expect(menu.labels()).not.toContain('Renommer l’objet')
  })

  // Greyed rather than dropped: a scene in a background tab has no viewport to move.
  it('refuses to frame while no viewport is mounted', () => {
    raise('box-1', vi.fn())

    expect(menu.offers('Cadrer la sélection')).toBe(false)
  })

  it('arms the node under the pointer, so the rows act on what was aimed at', async () => {
    useScenes.getState().replace('doc-1', { ...scene(), selectedIds: ['box-3'] })
    menu.picks('Supprimer')
    raise('box-1')

    await vi.waitFor(() => expect(sceneNodeNow('doc-1', 'box-1')).toBeNull())
    expect(sceneNodeNow('doc-1', 'box-3')).not.toBeNull()
  })

  // The other half of the same rule: a right-click inside a selection must not shrink it to one.
  it('keeps a selection the node already belongs to', async () => {
    useScenes.getState().replace('doc-1', { ...scene(), selectedIds: ['box-1', 'box-2'] })
    menu.picks('Supprimer')
    raise('box-1')

    await vi.waitFor(() => expect(sceneNodeNow('doc-1', 'box-1')).toBeNull())
    expect(sceneNodeNow('doc-1', 'box-2')).toBeNull()
  })

  // The one row that stays on the node aimed at: a selection half hidden has no state to flip.
  it('hides the node under the pointer and nothing else', async () => {
    useScenes.getState().replace('doc-1', { ...scene(), selectedIds: ['box-1', 'box-2'] })
    menu.picks('Masquer l’objet')
    raise('box-1')

    await vi.waitFor(() => expect(sceneNodeNow('doc-1', 'box-1')?.visible).toBe(false))
    expect(sceneNodeNow('doc-1', 'box-2')?.visible).toBe(true)
  })

  it('offers to show a node that is hidden', () => {
    useScenes.getState().runCommand('doc-1', setNodeVisible('box-1', false))
    raise('box-1')

    expect(menu.labels()).toContain('Afficher l’objet')
  })
})
