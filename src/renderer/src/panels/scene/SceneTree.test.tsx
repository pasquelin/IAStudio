import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeMenu } from '@/helpers/menu-fixtures'
import { installFakeBridge } from '@/services/fake-bridge'
import { installScene } from '@/stores/scene-fixtures'
import { sceneOf, useScenes } from '@/stores/scenes'
import { SceneTree } from './SceneTree'

/** jsdom implements no `DataTransfer`; the tree reads exactly these three members of one. */
function dragData() {
  const held = new Map<string, string>()
  const data = {
    // Read on the event after the one that set it, so it has to follow along.
    types: [] as string[],
    setData: (type: string, value: string) => {
      held.set(type, value)
      data.types = [...held.keys()]
    },
    getData: (type: string) => held.get(type) ?? '',
  }
  return data
}

function scene() {
  return sceneOf(useScenes.getState(), 'doc-1')
}

beforeEach(() => {
  installScene('doc-1')
})

describe('SceneTree', () => {
  it('shows the scene root and its three default lights', () => {
    render(<SceneTree documentId="doc-1" />)

    expect(screen.getByText('Scène')).toBeInTheDocument()
    expect(screen.getByText('AmbientLight')).toBeInTheDocument()
    expect(screen.getByText('DirectionalLight')).toBeInTheDocument()
    expect(screen.getByText('HemisphereLight')).toBeInTheDocument()
  })

  it('selects the node the user clicks', async () => {
    render(<SceneTree documentId="doc-1" />)

    await userEvent.click(screen.getByText('AmbientLight'))

    expect(scene().selectedIds).toEqual([scene().nodes[0]?.id])
  })

  it('adds a node to the selection on a command-click, and removes it on the next', async () => {
    const user = userEvent.setup()
    render(<SceneTree documentId="doc-1" />)

    await user.click(screen.getByText('AmbientLight'))
    await user.keyboard('{Meta>}')
    await user.click(screen.getByText('HemisphereLight'))
    expect(scene().selectedIds).toHaveLength(2)

    await user.click(screen.getByText('HemisphereLight'))
    await user.keyboard('{/Meta}')
    expect(scene().selectedIds).toEqual([scene().nodes[0]?.id])
  })

  it('selects everything between the anchor and a shift-clicked node', async () => {
    const user = userEvent.setup()
    render(<SceneTree documentId="doc-1" />)

    await user.click(screen.getByText('AmbientLight'))
    await user.keyboard('{Shift>}')
    await user.click(screen.getByText('HemisphereLight'))
    await user.keyboard('{/Shift}')

    expect(scene().selectedIds).toEqual(scene().nodes.map(node => node.id))
  })

  // The root is drawn, but it is not a node: selecting it means selecting nothing.
  it('clears the selection when the root is clicked', async () => {
    render(<SceneTree documentId="doc-1" />)

    await userEvent.click(screen.getByText('AmbientLight'))
    await userEvent.click(screen.getByText('Scène'))

    expect(scene().selectedIds).toEqual([])
  })

  // Extending to a row that cannot be selected has nowhere to land: it clears, like a plain click.
  it('never puts the root into a selection, whatever modifier is held', async () => {
    const user = userEvent.setup()
    render(<SceneTree documentId="doc-1" />)

    await user.click(screen.getByText('HemisphereLight'))
    await user.keyboard('{Shift>}')
    await user.click(screen.getByText('Scène'))
    await user.keyboard('{/Shift}')

    expect(scene().selectedIds).toEqual([])
  })

  it('offers no eye on the root, which has nothing to hide', () => {
    render(<SceneTree documentId="doc-1" />)

    expect(screen.getAllByRole('button', { name: 'Afficher ou masquer' })).toHaveLength(3)
  })

  it('toggles visibility from the eye, through the history', async () => {
    render(<SceneTree documentId="doc-1" />)

    const eyes = screen.getAllByRole('button', { name: 'Afficher ou masquer' })
    await userEvent.click(eyes[0] as HTMLElement)
    expect(scene().nodes[0]?.visible).toBe(false)

    useScenes.getState().undo('doc-1')
    expect(scene().nodes[0]?.visible).toBe(true)
  })

  it('leaves the selection alone when the eye is clicked', async () => {
    render(<SceneTree documentId="doc-1" />)

    const eyes = screen.getAllByRole('button', { name: 'Afficher ou masquer' })
    await userEvent.click(eyes[1] as HTMLElement)

    expect(scene().selectedIds).toEqual([])
  })

  it('hangs a node from another when its row is dropped onto it, through the history', () => {
    render(<SceneTree documentId="doc-1" />)
    const rows = screen.getAllByRole('treeitem')

    const data = dragData()
    fireEvent.dragStart(rows[1]!, { dataTransfer: data })
    fireEvent.drop(rows[2]!, { dataTransfer: data })

    const [first, second] = scene().nodes
    expect(first?.parentId).toBe(second?.id)

    useScenes.getState().undo('doc-1')
    expect(scene().nodes[0]?.parentId).toBeNull()
  })

  // The root stands for the scene: dropping onto it is how a node comes back out of a group.
  it('brings a node back out to the scene when dropped on the root', () => {
    render(<SceneTree documentId="doc-1" />)
    const rowOf = (name: string): HTMLElement =>
      screen.getByText(name).closest('[role="treeitem"]') as HTMLElement

    const down = dragData()
    fireEvent.dragStart(rowOf('AmbientLight'), { dataTransfer: down })
    fireEvent.drop(rowOf('DirectionalLight'), { dataTransfer: down })
    expect(scene().nodes[0]?.parentId).not.toBeNull()

    // The drop opened the branch it landed in, so the moved row is still on screen.
    const out = dragData()
    fireEvent.dragStart(rowOf('AmbientLight'), { dataTransfer: out })
    fireEvent.drop(rowOf('Scène'), { dataTransfer: out })

    expect(scene().nodes[0]?.parentId).toBeNull()
  })

  it('folds the root away, which is session state and not an edit', async () => {
    render(<SceneTree documentId="doc-1" />)

    await userEvent.click(screen.getAllByRole('treeitem')[0]?.firstChild as HTMLElement)

    expect(screen.queryByText('AmbientLight')).not.toBeInTheDocument()
  })

  it('raises the node menu on a right-click, and nothing on the root', () => {
    const menu = fakeMenu()
    installFakeBridge({ menu: menu.bridge })
    render(<SceneTree documentId="doc-1" />)

    fireEvent.contextMenu(screen.getByText('AmbientLight'))
    expect(menu.labels()).toContain('Supprimer')

    // The root is a row but not a node: it stands for the scene, which has no name and no delete.
    fireEvent.contextMenu(screen.getByText('Scène'))
    expect(menu.raised).toHaveLength(1)
  })

  /**
   * The rows of that menu act on the SELECTION, so what a right-click does to it is half the
   * gesture: it aims, it never composes. The pointer event matters as much as the menu one, and
   * macOS is where it bit hardest — Chromium delivers the Mac's secondary click as button 2 WITH
   * `ctrlKey`, which the row read as a toggle and used to take the node back out, leaving a
   * delete row that acted on the five others or on nothing at all. Not written as a case of its
   * own: the polyfilled pointer event of this environment drops the modifier, so it would pass
   * on the very defect it describes. One filter answers both.
   */
  it('keeps a selection of several when one of them is right-clicked', async () => {
    const user = userEvent.setup()
    installFakeBridge({ menu: fakeMenu().bridge })
    render(<SceneTree documentId="doc-1" />)
    const rowOf = (name: string): HTMLElement =>
      screen.getByText(name).closest('[role="treeitem"]') as HTMLElement

    await user.click(screen.getByText('AmbientLight'))
    await user.keyboard('{Meta>}')
    await user.click(screen.getByText('HemisphereLight'))
    await user.keyboard('{/Meta}')
    expect(scene().selectedIds).toHaveLength(2)

    fireEvent.pointerDown(rowOf('AmbientLight'), { button: 2 })
    fireEvent.contextMenu(rowOf('AmbientLight'), { button: 2 })

    expect(scene().selectedIds).toHaveLength(2)
  })

  it('renames a node from its own row, through the history', async () => {
    render(<SceneTree documentId="doc-1" />)

    await userEvent.dblClick(screen.getByText('AmbientLight'))
    await userEvent.clear(screen.getByLabelText('Renommer l’objet'))
    await userEvent.type(screen.getByLabelText('Renommer l’objet'), 'Soleil{Enter}')

    expect(scene().nodes[0]?.name).toBe('Soleil')
    useScenes.getState().undo('doc-1')
    expect(scene().nodes[0]?.name).toBe('AmbientLight')
  })
})
