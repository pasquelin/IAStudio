import i18next from 'i18next'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { meshNode } from '@/engines/scene/scene-fixtures'
import type { SceneNode } from '@/engines/scene/sceneState'
import { fakeMenu } from '@/helpers/menu-fixtures'
import { installFakeBridge } from '@/services/fakeBridge'
import { openSceneNodeMenu } from './sceneNodeMenu'

let menu = fakeMenu()
const run = vi.fn()
const onToggleVisible = vi.fn()
const onRename = vi.fn()

const hidden = (node: SceneNode): SceneNode => ({ ...node, visible: false })

/** Raises the menu, since a native one leaves nothing on screen for a case to read. */
function raise(node: SceneNode = meshNode('box-1')): void {
  openSceneNodeMenu({ node, canFrame: true, t: i18next.t, run, onToggleVisible, onRename })
}

/** The same from the viewport, which has no name to open and therefore no rename to hand back. */
function raiseInViewport(node: SceneNode = meshNode('box-1')): void {
  openSceneNodeMenu({ node, canFrame: true, t: i18next.t, run, onToggleVisible })
}

describe('what the 3D space offers to do with a node', () => {
  beforeEach(() => {
    menu = fakeMenu()
    vi.clearAllMocks()
    installFakeBridge({ menu: menu.bridge })
  })

  it('offers the whole vocabulary of the outliner in one press', () => {
    raise()

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
    raiseInViewport()

    expect(menu.labels()).not.toContain('Renommer l’objet')
  })

  // Greyed rather than dropped: a scene in a background tab has no viewport to move.
  it('refuses to frame while no viewport is mounted', () => {
    openSceneNodeMenu({
      node: meshNode('box-1'),
      canFrame: false,
      t: i18next.t,
      run,
      onToggleVisible,
    })

    expect(menu.offers('Cadrer la sélection')).toBe(false)
  })

  /**
   * The rows are the very ids the toolbar and the keyboard run — the point of the whole shape.
   * A row that ran a command of its own would pass this file and drift from the other two doors.
   */
  it('sends the delete through the space’s own dispatch', async () => {
    menu.picks('Supprimer')
    raise()

    await vi.waitFor(() => expect(run).toHaveBeenCalledWith('scene.delete'))
  })

  it('offers to show a node that is hidden, and hands the eye back to its owner', async () => {
    menu.picks('Afficher l’objet')
    raise(hidden(meshNode('box-1')))

    await vi.waitFor(() => expect(onToggleVisible).toHaveBeenCalled())
    expect(run).not.toHaveBeenCalled()
  })

  // The rename is the row's own state — the menu asks for it rather than running a command.
  it('hands the rename back to the row instead of commanding it', async () => {
    menu.picks('Renommer l’objet')
    raise()

    await vi.waitFor(() => expect(onRename).toHaveBeenCalled())
    expect(run).not.toHaveBeenCalled()
  })
})
