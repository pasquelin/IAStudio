import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Asset, AssetType } from '@shared/domain/asset'
import { STUDIO_ENVIRONMENT, TEXTURE_SLOTS } from '@shared/domain/scene'
import { addNode } from '@/engines/scene/commands'
import { createNodeOf } from '@/engines/scene/node-factory'
import { lightNodeFixture, meshNode, spriteNodeFixture } from '@/engines/scene/scene-fixtures'
import {
  DEFAULT_MATERIAL,
  IDENTITY_TRANSFORM,
  type SceneNode,
  type SceneState,
} from '@/engines/scene/scene-state'
import type { Transform } from '@shared/domain/scene'
import { EMPTY_TIMELINE } from '@shared/domain/animation'
import { useAssets } from '@/stores/assets'
import { installCanvas } from '@/stores/canvas-fixtures'
import { installDocuments } from '@/stores/document-fixtures'
import { useDocuments } from '@/stores/documents'
import { useSelection } from '@/stores/selection'
import { modelNodeFixture } from '@/engines/scene/scene-fixtures'
import { useModelClips } from '@/stores/model-clips'
import { installScene, sceneNodeNow } from '@/stores/scene-fixtures'
import { installTexture } from '@/stores/texture-fixtures'
import { useTextureViews } from '@/stores/texture-views'
import { textureOf, useTextures } from '@/stores/textures'
import { setChannel } from '@/engines/texture/commands'
import { connectSceneSelection } from '@/stores/scene-selection'
import { addModelTo, sceneHistoryOf, sceneOf, selectIn, useScenes } from '@/stores/scenes'
import { definition } from '.'
import { EMPTY_SCENE } from '@/engines/scene/scene-state'

const { Content } = definition

function install(node: SceneNode, selected = true): SceneState {
  const state: SceneState = {
    ...EMPTY_SCENE,
    nodes: [node],
    selectedIds: selected ? [node.id] : [],
  }
  installScene('doc-1', state)
  return state
}

function moved(x: number, y: number, z: number): Transform {
  return { ...IDENTITY_TRANSFORM, position: { x, y, z } }
}

function turned(x: number, y: number, z: number): Transform {
  return { ...IDENTITY_TRANSFORM, rotation: { x, y, z } }
}

const nodeInStore = (id: string): SceneNode | null => sceneNodeNow('doc-1', id)

const entries = () => sceneHistoryOf(useScenes.getState(), 'doc-1').past.length

/** The drag handle of one axis. Throws rather than narrowing, so a miss reads as a miss. */
function axisHandle(axis: string, occurrence = 0): HTMLElement {
  const handles = screen.getAllByText(axis)
  const handle = handles.at(occurrence)
  if (!handle) throw new Error(`no ${axis} handle at ${occurrence}`)
  return handle
}

beforeEach(() => {
  install(meshNode('box-1'))
})

describe('inspector panel', () => {
  it('asks for a selection when no document can offer one', () => {
    useDocuments.setState({ activeId: null })
    render(<Content />)

    expect(screen.getByText(/Sélectionnez un élément/)).toBeInTheDocument()
  })

  // The environment belongs to the document rather than to a node, so it is what the panel shows
  // when nothing is selected — in place of a message saying there is nothing to show.
  it('shows what lights the scene when nothing is selected', () => {
    install(meshNode('box-1'), false)
    render(<Content />)

    expect(screen.getByRole('button', { name: /Environnement/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Transformation/ })).not.toBeInTheDocument()
  })

  it('offers the skies of the project, and the studio to come back to', async () => {
    useAssets.setState({
      items: [
        {
          id: 'sky-1',
          name: 'Coucher',
          type: 'skybox',
          location: 'local',
          path: 'assets/sky-1.png',
          tags: [],
          createdAt: '2026-08-08T00:00:00.000Z',
        },
      ],
    })
    render(<Content />)

    await userEvent.click(screen.getByRole('button', { name: /Choisir un ciel/ }))

    expect(await screen.findByRole('menuitemradio', { name: /Coucher/ })).toBeInTheDocument()
  })

  it('writes the chosen sky into the document, through the history', async () => {
    useAssets.setState({
      items: [
        {
          id: 'sky-1',
          name: 'Coucher',
          type: 'skybox',
          location: 'local',
          path: 'assets/sky-1.png',
          tags: [],
          createdAt: '2026-08-08T00:00:00.000Z',
        },
      ],
    })
    render(<Content />)

    await userEvent.click(screen.getByRole('button', { name: /Choisir un ciel/ }))
    await userEvent.click(await screen.findByRole('menuitemradio', { name: /Coucher/ }))

    expect(sceneOf(useScenes.getState(), 'doc-1').environment).toEqual({
      kind: 'skybox',
      assetId: 'sky-1',
    })

    useScenes.getState().undo('doc-1')
    expect(sceneOf(useScenes.getState(), 'doc-1').environment).toEqual({ kind: 'studio' })
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

  it('shows a sprite its own section, and no material', () => {
    install(spriteNodeFixture('sprite-1'))
    render(<Content />)

    expect(screen.getByRole('button', { name: /Sprite/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Matériau/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Transformation/ })).toBeInTheDocument()
  })

  // three.js draws meshes into a shadow map and nothing else: both switches would be inert.
  it('offers a sprite no shadow section at all', () => {
    install(spriteNodeFixture('sprite-1'))
    render(<Content />)

    expect(screen.queryByRole('button', { name: /Ombres/ })).not.toBeInTheDocument()
  })

  /**
   * The viewport already refused the handle over a lone sprite; the row went on taking an angle
   * nothing draws, which stacked an undo for a screen that never moved.
   */
  it('offers a lone sprite no rotation row, and keeps the two that show', () => {
    install(spriteNodeFixture('sprite-1'))
    render(<Content />)

    expect(screen.queryByText('Rotation')).not.toBeInTheDocument()
    expect(screen.getByText('Position')).toBeInTheDocument()
    expect(screen.getByText('Échelle')).toBeInTheDocument()
  })

  it('gives the row back to a sprite others hang from, which turning swings around it', () => {
    installScene('doc-1', {
      ...EMPTY_SCENE,
      nodes: [spriteNodeFixture('sprite-1'), meshNode('box-1', 'sprite-1')],
      selectedIds: ['sprite-1'],
    })
    render(<Content />)

    expect(screen.getByText('Rotation')).toBeInTheDocument()
  })

  // The anchor is the last node picked, and it is not what the row is for: a cube selected after
  // a sprite still turns, and deciding on the anchor alone took its row away.
  it('keeps the row when a sprite is the anchor of a selection something else turns in', () => {
    installScene('doc-1', {
      ...EMPTY_SCENE,
      nodes: [meshNode('box-1'), spriteNodeFixture('sprite-1')],
      selectedIds: ['box-1', 'sprite-1'],
    })
    render(<Content />)

    expect(screen.getByText('Rotation')).toBeInTheDocument()
  })

  it('fades a sprite through the history', () => {
    install(spriteNodeFixture('sprite-1'))
    render(<Content />)

    fireEvent.change(screen.getByLabelText('Opacité'), { target: { value: '0.4' } })

    const node = nodeInStore('sprite-1')
    expect(node?.type === 'sprite' && node.sprite.opacity).toBe(0.4)

    useScenes.getState().undo('doc-1')
    const back = nodeInStore('sprite-1')
    expect(back?.type === 'sprite' && back.sprite.opacity).toBe(1)
  })

  it('follows the selection', () => {
    installScene('doc-1', {
      ...EMPTY_SCENE,
      nodes: [meshNode('box-1'), lightNodeFixture('light-1')],
      selectedIds: ['light-1'],
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
      const handle = axisHandle('X')

      fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 0 })
      fireEvent.pointerMove(handle, { pointerId: 1, clientX: 20 })

      expect(nodeInStore('box-1')?.transform.position.x).toBe(2)
    })

    // Radians are what the document stores; nobody types in them.
    it('turns the node in degrees', () => {
      render(<Content />)
      const handle = axisHandle('Y', 1)

      fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 0 })
      fireEvent.pointerMove(handle, { pointerId: 1, clientX: 90 })

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
      const handle = axisHandle('Z', -1)

      fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 0 })
      fireEvent.pointerMove(handle, { pointerId: 1, clientX: 10 })

      const node = nodeInStore('light-1')
      expect(node?.type === 'light' && node.light.kind === 'spot' && node.light.target.z).toBe(1)
    })
  })

  describe('history', () => {
    it('leaves one entry for a whole drag, and undo gives the node back', () => {
      render(<Content />)
      const handle = axisHandle('X')

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
      const handle = axisHandle('X')

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

  describe('textures', () => {
    const asset = (id: string, name: string, type: AssetType): Asset => ({
      id,
      name,
      type,
      location: 'local',
      path: `assets/${id}.png`,
      tags: [],
      createdAt: '2026-08-07T00:00:00.000Z',
    })

    beforeEach(() => {
      useAssets.setState({
        items: [
          asset('tex-1', 'Brique', 'texture'),
          asset('img-1', 'Rendu', 'image'),
          asset('vid-1', 'Rush', 'video'),
        ],
      })
    })

    // What the studio generates lands in `image` far more often than in `texture`.
    it('offers the pictures of the project, whatever folder they were filed under', async () => {
      render(<Content />)

      await userEvent.click(screen.getAllByRole('button', { name: /Choisir la texture de/ })[0]!)

      expect(await screen.findByRole('menuitemradio', { name: /Brique/ })).toBeInTheDocument()
      expect(screen.getByRole('menuitemradio', { name: /Rendu/ })).toBeInTheDocument()
    })

    it('leaves out what could never be loaded as a texture', async () => {
      render(<Content />)

      await userEvent.click(screen.getAllByRole('button', { name: /Choisir la texture de/ })[0]!)
      await screen.findByRole('menuitemradio', { name: /Brique/ })

      expect(screen.queryByRole('menuitemradio', { name: /Rush/ })).not.toBeInTheDocument()
    })

    // A texture is a reference to an asset, never an image: that is what a reopened scene can
    // resolve again.
    it('stores the asset identifier in the material', async () => {
      render(<Content />)

      await userEvent.click(screen.getAllByRole('button', { name: /Choisir la texture de/ })[0]!)
      await userEvent.click(await screen.findByRole('menuitemradio', { name: /Brique/ }))

      const node = nodeInStore('box-1')
      expect(node?.type === 'mesh' && node.material.map).toEqual({ assetId: 'tex-1' })
    })

    it('empties the slot it is asked to clear, and undo puts it back', async () => {
      install({
        ...meshNode('box-1'),
        material: { ...DEFAULT_MATERIAL, map: { assetId: 'tex-1' } },
      })
      render(<Content />)

      await userEvent.click(screen.getAllByRole('button', { name: /Retirer la texture/ })[0]!)

      const cleared = nodeInStore('box-1')
      expect(cleared?.type === 'mesh' && cleared.material.map).toBeNull()

      useScenes.getState().undo('doc-1')
      const back = nodeInStore('box-1')
      expect(back?.type === 'mesh' && back.material.map).toEqual({ assetId: 'tex-1' })
    })

    it('offers a slot per map a standard material reads', () => {
      render(<Content />)

      expect(screen.getAllByRole('button', { name: /Choisir la texture de/ })).toHaveLength(
        TEXTURE_SLOTS.length,
      )
    })

    /**
     * The whole LINE is what opens the menu since 2026-08-14, so its name is the only thing left
     * to tell five stacked slots apart by — a reader stepping through them, or a voice command
     * naming the one on screen. One shared « Choose a texture » made them five identical controls.
     */
    it('names each slot after the map it fills, so the stacked ones can be told apart', () => {
      render(<Content />)

      const named = screen
        .getAllByRole('button', { name: /Choisir la texture de/ })
        .map(button => button.getAttribute('aria-label'))

      expect(new Set(named).size).toBe(TEXTURE_SLOTS.length)
    })
  })

  it('shows the node name, and renames it', async () => {
    render(<Content />)

    const name = screen.getByLabelText('Nom')
    expect(name).toHaveValue('box-1')

    await userEvent.clear(name)
    await userEvent.type(name, 'Socle')

    expect(nodeInStore('box-1')?.name).toBe('Socle')
  })

  // The anchor is what the fields read out; what they write to is the whole selection.
  describe('several nodes at once', () => {
    function installPair(): void {
      installScene('doc-1', {
        ...EMPTY_SCENE,
        nodes: [meshNode('box-1'), meshNode('box-2'), lightNodeFixture('light-1')],
        selectedIds: ['box-2', 'box-1'],
      })
    }

    it('reads out the anchor, which is the last node picked', () => {
      installPair()
      render(<Content />)

      expect(screen.getByLabelText('Nom')).toHaveValue('box-1')
    })

    it('writes a typed geometry parameter onto every selected mesh, as one entry', async () => {
      installPair()
      render(<Content />)

      const width = screen.getByLabelText('Largeur')
      await userEvent.clear(width)
      await userEvent.type(width, '4')
      await userEvent.tab()

      for (const id of ['box-1', 'box-2']) {
        const node = nodeInStore(id)
        expect(node?.type === 'mesh' && node.geometry).toMatchObject({ width: 4 })
      }
      expect(entries()).toBe(1)

      useScenes.getState().undo('doc-1')
      const back = nodeInStore('box-2')
      expect(back?.type === 'mesh' && back.geometry).toMatchObject({ width: 1 })
    })

    it('writes only the axis it was given, so the others keep their own values', () => {
      installScene('doc-1', {
        nodes: [
          { ...meshNode('box-1'), transform: moved(1, 0, 0) },
          { ...meshNode('box-2'), transform: moved(5, 0, 0) },
        ],
        selectedIds: ['box-2', 'box-1'],
        environment: STUDIO_ENVIRONMENT,
        animation: EMPTY_TIMELINE,
      })
      render(<Content />)
      const handle = axisHandle('Y')

      fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 0 })
      fireEvent.pointerMove(handle, { pointerId: 1, clientX: 20 })

      expect(nodeInStore('box-1')?.transform.position).toMatchObject({ x: 1, y: 2 })
      expect(nodeInStore('box-2')?.transform.position).toMatchObject({ x: 5, y: 2 })
    })

    // A sphere and a box share no width, and writing one into the other changes a shape nobody
    // looked at.
    it('leaves a node of another kind alone', () => {
      installPair()
      render(<Content />)

      fireEvent.change(screen.getByLabelText('Couleur'), { target: { value: '#ff0000' } })

      const light = nodeInStore('light-1')
      expect(light?.type).toBe('light')
      const other = nodeInStore('box-2')
      expect(other?.type === 'mesh' && other.material.color).toBe('#ff0000')
    })

    // The field reports degrees and the document stores radians; diffing after the conversion
    // back declared untouched axes moved, and wrote the anchor's own angle onto everyone else.
    it('turns one axis without carrying the anchor over the others', () => {
      installScene('doc-1', {
        nodes: [
          { ...meshNode('box-1'), transform: turned(0.1, 0, 0) },
          { ...meshNode('box-2'), transform: turned(1.5, 0, 0) },
        ],
        selectedIds: ['box-2', 'box-1'],
        environment: STUDIO_ENVIRONMENT,
        animation: EMPTY_TIMELINE,
      })
      render(<Content />)
      const handle = axisHandle('Y', 1)

      fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 0 })
      fireEvent.pointerMove(handle, { pointerId: 1, clientX: 90 })

      expect(nodeInStore('box-1')?.transform.rotation.x).toBeCloseTo(0.1)
      expect(nodeInStore('box-2')?.transform.rotation.x).toBeCloseTo(1.5)
      expect(nodeInStore('box-2')?.transform.rotation.y).toBeCloseTo(Math.PI / 2)
    })

    it('renames the anchor only: three nodes of one name is not a rename', async () => {
      installPair()
      render(<Content />)

      const name = screen.getByLabelText('Nom')
      await userEvent.clear(name)
      await userEvent.type(name, 'Socle')

      expect(nodeInStore('box-1')?.name).toBe('Socle')
      expect(nodeInStore('box-2')?.name).toBe('box-2')
    })
  })

  it('adds nothing to the history for a node added elsewhere', () => {
    const cube = createNodeOf('box')
    if (cube) useScenes.getState().runCommand('doc-1', addNode(cube))
    render(<Content />)

    expect(entries()).toBe(1)
  })

  // One panel for the whole studio: picking a layer describes it where a clip would be described.
  it('describes the layer picked in the stack', () => {
    installCanvas('doc-1')
    useSelection.getState().selectLayer('doc-1', 'layer-1')
    render(<Content />)

    expect(screen.getByText('Composition')).toBeInTheDocument()
  })

  // The image in front is not necessarily the one the layer was picked in.
  it('says nothing for a layer picked in another document', () => {
    installCanvas('doc-1')
    useSelection.getState().selectLayer('elsewhere', 'layer-1')
    render(<Content />)

    expect(screen.queryByText('Composition')).not.toBeInTheDocument()
  })

  /**
   * A texture has nothing to select: the material IS the document, so its face shows on the same
   * default branch a scene does — and nothing has to be clicked first.
   */
  describe('the document in front, when nothing was picked', () => {
    // Cleared on purpose: the suite above points the selection at a layer, and a face chosen by
    // `selection.kind` would answer that instead of the document this describes.
    beforeEach(() => {
      useSelection.getState().clear()
    })

    it('describes the material of a texture', () => {
      installTexture('doc-1')
      render(<Content />)

      expect(screen.getByLabelText('Rugosité')).toBeInTheDocument()
    })

    /** The section folds, and a folded one keeps no field mounted — see `PropertySection`. */
    const openTiling = () => userEvent.click(screen.getByRole('button', { name: /^Répétition$/ }))

    /**
     * The preview multiplier and the seam shift live under the values they act on, and neither
     * ever reaches a scene: written into `material.tiling`, a glance would go out with the file.
     */
    it('multiplies the repeat for the preview without writing it into the material', async () => {
      installTexture('doc-1')
      render(<Content />)
      await openTiling()

      await userEvent.click(screen.getByRole('button', { name: '4×' }))

      const texture = textureOf(useTextures.getState(), 'doc-1')
      expect(texture.preview.tilingPreview).toBe(4)
      expect(texture.material.tiling).toEqual({ x: 1, y: 1 })
    })

    it('brings the seams to the middle without writing an offset into the material', async () => {
      installTexture('doc-1')
      render(<Content />)
      await openTiling()

      await userEvent.click(screen.getByLabelText('Amener les coutures au centre'))

      const texture = textureOf(useTextures.getState(), 'doc-1')
      expect(texture.preview.showSeam).toBe(true)
      expect(texture.material.offset).toEqual({ x: 0, y: 0 })
    })

    /** A measurement asks the GPU for a context: it is offered where there is nothing to read. */
    it('refuses to measure a seam with no base colour to measure it on', async () => {
      installTexture('doc-1')
      render(<Content />)
      await openTiling()

      expect(screen.getByRole('button', { name: 'Mesurer' })).toBeDisabled()
    })

    it('offers the measurement once a base colour is there', async () => {
      installTexture('doc-1')
      useTextures
        .getState()
        .runCommand(
          'doc-1',
          setChannel('baseColor', { assetId: 'img-1', origin: 'imported', width: 8, height: 8 }),
        )
      render(<Content />)
      await openTiling()

      expect(screen.getByRole('button', { name: 'Mesurer' })).toBeEnabled()
    })

    /** The base colour a reading was taken off, so the words on screen can be checked against it. */
    const measured = (assetId: string, ratio: number) => {
      installTexture('doc-1')
      useTextures
        .getState()
        .runCommand(
          'doc-1',
          setChannel('baseColor', { assetId, origin: 'imported', width: 8, height: 8 }),
        )
      useTextureViews.setState({ seams: { 'doc-1': { assetId: 'img-1', ratio } } })
    }

    it('reads a measurement back in words rather than as a ratio', async () => {
      measured('img-1', 3)
      render(<Content />)
      await openTiling()

      expect(screen.getByText('Couture visible')).toBeInTheDocument()
    })

    /**
     * A reading describes one picture. Left on screen after the base colour was replaced, it
     * says "Visible seam" about pixels the document no longer points at.
     */
    it('drops the words when the base colour they described is gone', async () => {
      measured('img-2', 3)
      render(<Content />)
      await openTiling()

      expect(screen.queryByText('Couture visible')).not.toBeInTheDocument()
    })

    /**
     * Not a matter of precedence: `activeIdOfKind` answers for one kind, so a document is a scene
     * or a texture and never both. What this pins is that adding the second face left the first
     * one answering — the same branch now has two ways out.
     */
    it('shows the scene face for a 3D document, not the texture one', () => {
      install(meshNode('mesh-1'), false)
      render(<Content />)

      // `Rugosité` belongs to the material of a texture; a mesh material says `Rugosité` nowhere.
      expect(screen.queryByLabelText('Rugosité')).toBeNull()
      expect(screen.getByRole('button', { name: /Environnement/ })).toBeInTheDocument()
    })

    it('says nothing at all when the document in front is neither', () => {
      installCanvas('doc-1')
      render(<Content />)

      expect(
        screen.getByText('Sélectionnez un élément pour voir ses propriétés.'),
      ).toBeInTheDocument()
      expect(screen.queryByLabelText('Rugosité')).toBeNull()
    })
  })
})

describe('the inspector on an imported model', () => {
  // The panel selection outlives a test file, and one left behind puts another face of the
  // inspector in front — an asset's, a layer's — where this one reads a scene node.
  beforeEach(() => {
    useSelection.getState().clear()
  })

  it('offers no clip picker while the file has reported none', () => {
    install(modelNodeFixture('model-1'))
    render(<Content />)

    expect(screen.queryByLabelText('Clip')).not.toBeInTheDocument()
  })

  it('offers the clips the file brought', () => {
    install(modelNodeFixture('model-1'))
    useModelClips.setState({ clips: { 'doc-1': { 'model-1': ['walk'] } } })
    render(<Content />)

    expect(screen.getByLabelText('Clip')).toBeInTheDocument()
  })

  // The other half of extracting a model's textures: without a slot to point back at, an edited
  // picture has nowhere to land. Folded away, because the errand is a rare one — what the panel
  // shows on sight is the model's OWN pictures.
  it('offers a slot per map, reading « the file own » until one is overridden', async () => {
    install(modelNodeFixture('model-1'))
    render(<Content />)

    expect(screen.getByText('Textures du modèle')).toBeInTheDocument()
    expect(screen.queryByText('Celle du fichier')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Remplacer un canal/ }))

    expect(screen.getAllByText('Celle du fichier')).toHaveLength(TEXTURE_SLOTS.length)
  })
})

/**
 * The 3D space held its selection in the scene alone, where this panel never looked — so the
 * asset clicked to import a model went on being described for as long as the tab stayed open,
 * whatever was picked in the outliner or in the viewport afterwards.
 */
describe('the inspector and what is picked in a scene', () => {
  beforeEach(() => {
    useSelection.getState().clear()
  })

  it('describes the node picked in the scene, over the asset picked in the browser before it', () => {
    install(meshNode('box-1'), false)
    useSelection.getState().selectAssets(['asset-1'])
    selectIn('doc-1', ['box-1'])
    render(<Content />)

    expect(screen.getByText('Géométrie')).toBeInTheDocument()
  })

  /**
   * A COMMAND selects too — an import selects the model it just put down, a duplicate its copies,
   * ⌘Z what a delete dropped — and none of them go through `selectIn`. Dropping an asset in the
   * viewport therefore left the panel describing the asset that was dropped, while the outliner
   * highlighted the node it had become: the same thing named twice, two panels disagreeing, and
   * a second click on the row as the only way out.
   */
  it('describes the node an import just put down, not the asset it came from', () => {
    install(meshNode('box-1'), false)
    // The connector the application wires up: what the panel shows after an import is only half
    // the answer, and the other half is who told it — see `scene-selection.test.ts`.
    const stop = connectSceneSelection()
    useSelection.getState().selectAssets(['asset-1'])

    addModelTo('doc-1', {
      id: 'asset-1',
      name: 'Robot',
      type: 'mesh',
      location: 'local',
      tags: [],
      createdAt: '2026-08-14T10:00:00.000Z',
    })
    render(<Content />)

    expect(screen.getByText('Transformation')).toBeInTheDocument()
    stop()
  })

  // The scene's own face is what a click in the void leaves: its environment is read there, and
  // there is nowhere else to read it.
  it('falls back to the scene itself when the pick lands in the void', () => {
    install(meshNode('box-1'), false)
    selectIn('doc-1', ['box-1'])
    selectIn('doc-1', [])
    render(<Content />)

    expect(screen.getByText('Environnement')).toBeInTheDocument()
    expect(screen.queryByText('Géométrie')).not.toBeInTheDocument()
  })

  /**
   * Deselecting in one panel says nothing about another. It used to empty the whole descriptor:
   * five assets picked in the shelf went grey — and the two buttons that act on them with them —
   * because a cube was clicked away in a viewport beside it.
   */
  it('leaves what another panel has picked where it is', () => {
    install(meshNode('box-1'), false)
    useSelection.getState().selectAssets(['asset-1'])
    selectIn('doc-1', [])

    expect(useSelection.getState().selection.kind).toBe('asset')
  })

  /**
   * A node outlives the tab it was picked in — nothing clears the selection when one closes — so
   * it must not speak for a document it has nothing to do with. Guarded on the owner, the panel
   * went empty on every switch between two scenes; counted as a voice, it left every texture
   * opened afterwards with no face at all.
   */
  it('describes the scene in front, whichever one the node was picked in', () => {
    useScenes.setState({
      states: {
        'doc-1': { ...EMPTY_SCENE, nodes: [meshNode('box-1')] },
        'doc-2': { ...EMPTY_SCENE, nodes: [meshNode('box-2')] },
      },
      histories: {},
      saved: {},
    })
    installDocuments({ 'doc-1': '3d', 'doc-2': '3d' }, 'doc-1')
    selectIn('doc-1', ['box-1'])

    installDocuments({ 'doc-1': '3d', 'doc-2': '3d' }, 'doc-2')
    render(<Content />)

    // Its environment, since nothing is picked in it — and never the empty state, which is what
    // three panels contradicting each other looks like: the outliner of doc-2 highlights nothing
    // while the inspector claims there is nothing to describe.
    expect(screen.getByText('Environnement')).toBeInTheDocument()
  })

  it('describes a texture brought in front after a node was picked', () => {
    install(meshNode('box-1'), false)
    selectIn('doc-1', ['box-1'])
    installTexture('doc-2')
    render(<Content />)

    expect(screen.getByLabelText('Rugosité')).toBeInTheDocument()
  })
})
