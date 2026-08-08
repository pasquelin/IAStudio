import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { addNode } from '@/engines/scene/commands'
import { createNodeOf } from '@/engines/scene/node-factory'
import { installScene } from '@/stores/scene-fixtures'
import { nodesOfType, EMPTY_SCENE, type SceneNodeType } from '@/engines/scene/scene-state'
import { useDocuments } from '@/stores/documents'
import { sceneOf, useScenes } from '@/stores/scenes'
import { definition as lights } from '@/panels/lights'
import { definition as meshes } from '@/panels/meshes'

function nodes(type: SceneNodeType) {
  return nodesOfType(sceneOf(useScenes.getState(), 'doc-1').nodes, type)
}

function addCube() {
  const cube = createNodeOf('box')
  if (cube) useScenes.getState().runCommand('doc-1', addNode(cube))
  return cube
}

beforeEach(() => {
  installScene('doc-1')
})

describe('meshes panel', () => {
  const { Content, Actions } = meshes

  it('says the scene has no mesh rather than showing an empty box', () => {
    render(<Content />)

    expect(screen.getByText('Aucune maille. Ajoutez-en une pour commencer.')).toBeInTheDocument()
  })

  it('says so when no document is in front', () => {
    useDocuments.setState({ activeId: null })
    render(<Content />)

    expect(screen.getByText('Ouvrez une scène pour voir ses mailles.')).toBeInTheDocument()
  })

  it('never lists the lights', () => {
    render(<Content />)

    expect(screen.queryByText('AmbientLight')).not.toBeInTheDocument()
  })

  it('selects the mesh whose row is clicked', async () => {
    const cube = addCube()
    render(<Content />)

    await userEvent.click(screen.getByText('Box'))

    expect(sceneOf(useScenes.getState(), 'doc-1').selectedIds).toEqual([cube?.id])
  })

  it('adds the primitive chosen in the flyout, and undo removes it', async () => {
    render(<Actions />)

    await userEvent.hover(screen.getByRole('button', { name: /Ajouter une maille/ }))
    await userEvent.click(await screen.findByRole('menuitem', { name: /Cube/ }))

    expect(nodes('mesh')).toHaveLength(1)
    expect(nodes('mesh')[0]?.name).toBe('Box')

    useScenes.getState().undo('doc-1')
    expect(nodes('mesh')).toEqual([])
  })

  // A primitive that is not buildable yet is shown, so the menu never hides what is coming.
  it('greys the announced primitives instead of hiding them', async () => {
    render(<Actions />)

    await userEvent.hover(screen.getByRole('button', { name: /Ajouter une maille/ }))

    expect(await screen.findByRole('menuitem', { name: /Texte/ })).toBeDisabled()
    expect(screen.getByRole('menuitem', { name: /Sprite/ })).toBeDisabled()
  })

  // Hovering is not a keyboard gesture: the flyout has to open on the click too.
  it('opens the add menu on a click, not only on hover', async () => {
    render(<Actions />)

    await userEvent.click(screen.getByRole('button', { name: /Ajouter une maille/ }))

    expect(await screen.findByRole('menuitem', { name: /Cube/ })).toBeInTheDocument()
  })

  it('offers no delete while nothing is selected', () => {
    render(<Actions />)

    expect(screen.getByRole('button', { name: /Supprimer la maille/ })).toBeDisabled()
  })

  it('deletes the selected mesh', async () => {
    addCube()
    render(<Actions />)

    await userEvent.click(screen.getByRole('button', { name: /Supprimer la maille/ }))

    expect(nodes('mesh')).toEqual([])
  })

  // The panel owns half the scene: deleting the other half from here would be a surprise.
  it('refuses to delete a light selected elsewhere', () => {
    const light = nodes('light')[0]
    installScene('doc-1', {
      ...sceneOf(useScenes.getState(), 'doc-1'),
      selectedIds: light ? [light.id] : [],
    })
    render(<Actions />)

    expect(screen.getByRole('button', { name: /Supprimer la maille/ })).toBeDisabled()
  })
})

describe('lights panel', () => {
  const { Content, Actions } = lights

  it('lists the lights a new scene is born with', () => {
    render(<Content />)

    expect(screen.getByText('AmbientLight')).toBeInTheDocument()
    expect(screen.getByText('DirectionalLight')).toBeInTheDocument()
    expect(screen.getByText('HemisphereLight')).toBeInTheDocument()
  })

  it('warns that an unlit scene stays black rather than showing an empty box', () => {
    installScene('doc-1', EMPTY_SCENE)
    render(<Content />)

    expect(screen.getByText('Aucune lumière. La scène restera noire.')).toBeInTheDocument()
  })

  it('adds the light chosen in the flyout, and undo removes it', async () => {
    render(<Actions />)

    await userEvent.hover(screen.getByRole('button', { name: /Ajouter une lumière/ }))
    await userEvent.click(await screen.findByRole('menuitem', { name: /Projecteur/ }))

    expect(nodes('light')).toHaveLength(4)
    expect(nodes('light')[3]?.name).toBe('SpotLight')

    useScenes.getState().undo('doc-1')
    expect(nodes('light')).toHaveLength(3)
  })

  it('hides a light through the history, and undo brings it back', async () => {
    render(<Content />)

    const eyes = screen.getAllByRole('button', { name: 'Afficher ou masquer' })
    await userEvent.click(eyes[0] as HTMLElement)
    expect(nodes('light')[0]?.visible).toBe(false)

    useScenes.getState().undo('doc-1')
    expect(nodes('light')[0]?.visible).toBe(true)
  })

  // The row selects on click, and so does the eye: unstopped, the selection wrote back a copy
  // of the scene taken before the toggle and swallowed it.
  it('leaves the selection alone when the eye is clicked', async () => {
    render(<Content />)

    const eyes = screen.getAllByRole('button', { name: 'Afficher ou masquer' })
    await userEvent.click(eyes[1] as HTMLElement)

    expect(sceneOf(useScenes.getState(), 'doc-1').selectedIds).toEqual([])
  })
})
