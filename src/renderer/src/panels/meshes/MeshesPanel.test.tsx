import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { addNode } from '@/engines/scene/commands'
import { createDefaultScene } from '@/engines/scene/default-scene'
import { createNodeOf } from '@/engines/scene/node-factory'
import { useDocuments } from '@/stores/documents'
import { sceneOf, useScenes } from '@/stores/scenes'
import { MeshesActions, MeshesPanel } from './MeshesPanel'

function meshes() {
  return sceneOf(useScenes.getState(), 'doc-1').nodes.filter(node => node.type === 'mesh')
}

function addCube() {
  const cube = createNodeOf('box', 'Cube')
  if (cube) useScenes.getState().runCommand('doc-1', addNode(cube))
  return cube
}

beforeEach(() => {
  useScenes.setState({ states: { 'doc-1': createDefaultScene() }, histories: {} })
  useDocuments.setState({ activeId: 'doc-1' })
})

describe('MeshesPanel', () => {
  it('says the scene has no mesh rather than showing an empty box', () => {
    render(<MeshesPanel />)

    expect(screen.getByText('Aucune maille. Ajoutez-en une pour commencer.')).toBeInTheDocument()
  })

  it('says so when no document is in front', () => {
    useDocuments.setState({ activeId: null })
    render(<MeshesPanel />)

    expect(screen.getByText('Ouvrez une scène pour voir ses mailles.')).toBeInTheDocument()
  })

  it('never lists the lights', () => {
    render(<MeshesPanel />)

    expect(screen.queryByText('AmbientLight')).not.toBeInTheDocument()
  })

  it('lists the meshes of the scene', () => {
    addCube()
    render(<MeshesPanel />)

    expect(screen.getByText('Cube')).toBeInTheDocument()
  })

  it('selects the mesh whose row is clicked', async () => {
    const cube = addCube()
    render(<MeshesPanel />)

    await userEvent.click(screen.getByText('Cube'))

    expect(sceneOf(useScenes.getState(), 'doc-1').selectedId).toBe(cube?.id)
  })

  it('adds the primitive chosen in the flyout, and undo removes it', async () => {
    render(<MeshesActions />)

    await userEvent.hover(screen.getByRole('button', { name: /Ajouter une maille/ }))
    await userEvent.click(await screen.findByRole('menuitem', { name: /Cube/ }))

    expect(meshes()).toHaveLength(1)
    expect(meshes()[0]?.name).toBe('Cube')

    useScenes.getState().undo('doc-1')
    expect(meshes()).toEqual([])
  })

  // A primitive that is not buildable yet is shown, so the menu never hides what is coming.
  it('greys the announced primitives instead of hiding them', async () => {
    render(<MeshesActions />)

    await userEvent.hover(screen.getByRole('button', { name: /Ajouter une maille/ }))

    expect(await screen.findByRole('menuitem', { name: /Texte/ })).toBeDisabled()
    expect(screen.getByRole('menuitem', { name: /Sprite/ })).toBeDisabled()
  })

  it('offers no delete while nothing is selected', () => {
    render(<MeshesActions />)

    expect(screen.getByRole('button', { name: /Supprimer la maille/ })).toBeDisabled()
  })

  it('deletes the selected mesh', async () => {
    const cube = addCube()
    render(<MeshesActions />)

    expect(sceneOf(useScenes.getState(), 'doc-1').selectedId).toBe(cube?.id)
    await userEvent.click(screen.getByRole('button', { name: /Supprimer la maille/ }))

    expect(meshes()).toEqual([])
  })

  // The panel owns half the scene: deleting the other half from here would be a surprise.
  it('refuses to delete a light selected elsewhere', () => {
    const light = sceneOf(useScenes.getState(), 'doc-1').nodes[0]
    useScenes.setState(state => ({
      states: {
        'doc-1': {
          ...(state.states['doc-1'] ?? createDefaultScene()),
          selectedId: light?.id ?? null,
        },
      },
    }))
    render(<MeshesActions />)

    expect(screen.getByRole('button', { name: /Supprimer la maille/ })).toBeDisabled()
  })
})
