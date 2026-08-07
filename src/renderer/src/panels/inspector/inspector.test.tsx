import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { addNode } from '@/engines/scene/commands'
import { createNodeOf } from '@/engines/scene/node-factory'
import { lightNodeFixture, meshNode } from '@/engines/scene/scene-fixtures'
import { nodeById, type SceneNode, type SceneState } from '@/engines/scene/scene-state'
import { useDocuments } from '@/stores/documents'
import { installScene } from '@/stores/scene-fixtures'
import { historyOf, sceneOf, useScenes } from '@/stores/scenes'
import { definition } from '.'

const { Content } = definition

function install(node: SceneNode, selected = true): SceneState {
  const state: SceneState = { nodes: [node], selectedId: selected ? node.id : null }
  installScene('doc-1', state)
  return state
}

function nodeInStore(id: string): SceneNode | null {
  return nodeById(sceneOf(useScenes.getState(), 'doc-1'), id)
}

const entries = () => historyOf(useScenes.getState(), 'doc-1').past.length

beforeEach(() => {
  install(meshNode('box-1'))
})

describe('inspector panel', () => {
  it('says so when no scene is in front', () => {
    useDocuments.setState({ activeId: null })
    render(<Content />)

    expect(
      screen.getByText('Ouvrez une scène pour inspecter ce qu’elle contient.'),
    ).toBeInTheDocument()
  })

  it('says so when nothing is selected', () => {
    install(meshNode('box-1'), false)
    render(<Content />)

    expect(screen.getByText('Sélectionnez un objet pour voir ses propriétés.')).toBeInTheDocument()
  })

  it('shows the three sections of a mesh', () => {
    render(<Content />)

    expect(screen.getByRole('button', { name: /Transformation/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Géométrie/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Matériau/ })).toBeInTheDocument()
  })

  it('shows a light its own section, and no geometry', () => {
    install(
      lightNodeFixture('light-1', {
        kind: 'point',
        color: '#ffffff',
        intensity: 1,
        distance: 0,
        decay: 2,
      }),
    )
    render(<Content />)

    expect(screen.getByRole('button', { name: /Lumière/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Géométrie/ })).not.toBeInTheDocument()
    // A light is placed like anything else: the transform is not a mesh privilege.
    expect(screen.getByRole('button', { name: /Transformation/ })).toBeInTheDocument()
  })

  it('follows the selection', () => {
    installScene('doc-1', {
      nodes: [meshNode('box-1'), lightNodeFixture('light-1')],
      selectedId: 'light-1',
    })
    render(<Content />)

    expect(screen.getByRole('button', { name: /Lumière/ })).toBeInTheDocument()
  })

  describe('editing a mesh', () => {
    it('writes a typed geometry parameter into the state', async () => {
      render(<Content />)

      const width = screen.getByLabelText('Largeur')
      await userEvent.clear(width)
      await userEvent.type(width, '4')

      const node = nodeInStore('box-1')
      expect(node?.type === 'mesh' && node.geometry).toMatchObject({ kind: 'box', width: 4 })
    })

    it('leaves the rest of the geometry alone', async () => {
      render(<Content />)

      await userEvent.clear(screen.getByLabelText('Hauteur'))
      await userEvent.type(screen.getByLabelText('Hauteur'), '3')

      const node = nodeInStore('box-1')
      expect(node?.type === 'mesh' && node.geometry).toEqual({
        kind: 'box',
        width: 1,
        height: 3,
        depth: 1,
      })
    })

    it('writes a material colour', () => {
      render(<Content />)

      fireEvent.change(screen.getByLabelText('Couleur'), { target: { value: '#ff0000' } })

      const node = nodeInStore('box-1')
      expect(node?.type === 'mesh' && node.material.color).toBe('#ff0000')
    })

    it('moves the node it was handed', () => {
      render(<Content />)
      const handle = screen.getAllByText('X')[0]

      fireEvent.pointerDown(handle as HTMLElement, { button: 0, pointerId: 1, clientX: 0 })
      fireEvent.pointerMove(handle as HTMLElement, { pointerId: 1, clientX: 20 })

      expect(nodeInStore('box-1')?.transform.position.x).toBe(2)
    })

    // Radians are what the document stores; nobody types in them.
    it('turns the node in degrees', () => {
      render(<Content />)
      const handle = screen.getAllByText('Y')[1]

      fireEvent.pointerDown(handle as HTMLElement, { button: 0, pointerId: 1, clientX: 0 })
      fireEvent.pointerMove(handle as HTMLElement, { pointerId: 1, clientX: 90 })

      expect(nodeInStore('box-1')?.transform.rotation.y).toBeCloseTo(Math.PI / 2)
    })
  })

  describe('editing a light', () => {
    beforeEach(() => {
      install(
        lightNodeFixture('light-1', {
          kind: 'spot',
          color: '#ffffff',
          intensity: 1,
          distance: 0,
          angle: 0.3,
          penumbra: 0,
          decay: 2,
          target: { x: 0, y: 0, z: 0 },
        }),
      )
    })

    it('slides the intensity', () => {
      render(<Content />)

      fireEvent.change(screen.getByLabelText('Intensité'), { target: { value: '3.5' } })

      const node = nodeInStore('light-1')
      expect(node?.type === 'light' && node.light.intensity).toBe(3.5)
    })

    it('moves the target of the beam', () => {
      render(<Content />)
      const handle = screen.getAllByText('Z').at(-1)

      fireEvent.pointerDown(handle as HTMLElement, { button: 0, pointerId: 1, clientX: 0 })
      fireEvent.pointerMove(handle as HTMLElement, { pointerId: 1, clientX: 10 })

      const node = nodeInStore('light-1')
      expect(node?.type === 'light' && node.light.kind === 'spot' && node.light.target.z).toBe(1)
    })
  })

  describe('history', () => {
    it('leaves one entry for a whole drag, and undo gives the node back', () => {
      render(<Content />)
      const handle = screen.getAllByText('X')[0] as HTMLElement

      fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 0 })
      fireEvent.pointerMove(handle, { pointerId: 1, clientX: 10 })
      fireEvent.pointerMove(handle, { pointerId: 1, clientX: 20 })
      fireEvent.pointerMove(handle, { pointerId: 1, clientX: 30 })
      fireEvent.pointerUp(handle, { pointerId: 1 })

      expect(entries()).toBe(1)

      useScenes.getState().undo('doc-1')
      expect(nodeInStore('box-1')?.transform.position.x).toBe(0)
    })

    it('makes a typing session one entry', async () => {
      render(<Content />)

      const width = screen.getByLabelText('Largeur')
      await userEvent.click(width)
      await userEvent.clear(width)
      await userEvent.type(width, '12')
      await userEvent.tab()

      expect(entries()).toBe(1)
    })

    it('keeps two separate drags apart', () => {
      render(<Content />)
      const handle = screen.getAllByText('X')[0] as HTMLElement

      for (const distance of [10, 20]) {
        fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 0 })
        fireEvent.pointerMove(handle, { pointerId: 1, clientX: distance })
        fireEvent.pointerUp(handle, { pointerId: 1 })
      }

      expect(entries()).toBe(2)
    })
  })

  // The panel is derived from the descriptor: a primitive that shows no field would be a
  // primitive nobody can edit, and adding one must never mean writing a form.
  it('offers the parameters of every primitive without a component of its own', () => {
    const knot = createNodeOf('torusKnot')
    if (!knot) throw new Error('no torusKnot builder')
    install(knot)

    render(<Content />)

    expect(screen.getByLabelText('Rayon')).toBeInTheDocument()
    expect(screen.getByLabelText('Enroulements P')).toBeInTheDocument()
    expect(screen.getByLabelText('Segments tubulaires')).toBeInTheDocument()
  })

  it('shows the node name, and renames it', async () => {
    render(<Content />)

    const name = screen.getByLabelText('Nom')
    expect(name).toHaveValue('box-1')

    await userEvent.clear(name)
    await userEvent.type(name, 'Socle')

    expect(nodeInStore('box-1')?.name).toBe('Socle')
  })

  it('adds nothing to the history for a node added elsewhere', () => {
    const cube = createNodeOf('box')
    if (cube) useScenes.getState().runCommand('doc-1', addNode(cube))
    render(<Content />)

    expect(entries()).toBe(1)
  })
})
