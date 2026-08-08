import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { installScene } from '@/stores/scene-fixtures'
import { sceneOf, useScenes } from '@/stores/scenes'
import { SceneTree } from './SceneTree'

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

  it('folds the root away, which is session state and not an edit', async () => {
    render(<SceneTree documentId="doc-1" />)

    await userEvent.click(screen.getAllByRole('treeitem')[0]?.firstChild as HTMLElement)

    expect(screen.queryByText('AmbientLight')).not.toBeInTheDocument()
  })
})
