import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { drawsNode } from '@/engines/scene/isolation'
import { meshNode } from '@/engines/scene/scene-fixtures'
import { EMPTY_SCENE, type SceneState } from '@/engines/scene/sceneState'
import { installFakeBridge } from '@/services/fakeBridge'
import { installScene } from '@/stores/scene-fixtures'
import { sceneOf, useScenes } from '@/stores/scenes'
import { sceneViewOf, useSceneViews } from '@/stores/sceneViews'
import { useSettings } from '@/stores/settings'
import { definition } from '..'

const { Content } = definition

/** Two meshes, one of them hidden by its author — the case isolation must not undo. */
function installTwo(): SceneState {
  const state: SceneState = {
    ...EMPTY_SCENE,
    nodes: [meshNode('a'), { ...meshNode('b'), visible: false }, meshNode('c')],
    selectedIds: ['a'],
  }
  installScene('doc-1', state)
  return state
}

const world = () => sceneOf(useScenes.getState(), 'doc-1').world
const view = () => sceneViewOf(useSceneViews.getState(), 'doc-1')

describe('environment panel', () => {
  beforeEach(() => {
    installFakeBridge()
    useSettings.setState({ settings: DEFAULT_SETTINGS })
    useSceneViews.setState({ views: {} })
    installTwo()
  })

  it('lights a scene the studio way until somebody says otherwise', () => {
    render(<Content />)

    expect(screen.getByRole('button', { name: /Éclairage/ })).toBeInTheDocument()
    expect(world().environment).toEqual({ kind: 'studio' })
  })

  describe('looks', () => {
    it('writes the fields the look is about', async () => {
      render(<Content />)
      await userEvent.click(screen.getByRole('button', { name: 'Nuit' }))

      expect(world().toneMapping).toBe('aces')
      expect(world().exposure).toBeGreaterThan(1)
      expect(world().background).toEqual({ kind: 'color', color: '#0b0e14' })
    })

    // A look settles the environment, never the scene: adding a sun would put a row in the
    // outliner, an entry in the history and a light in every export.
    it('adds no node to the scene', async () => {
      render(<Content />)
      await userEvent.click(screen.getByRole('button', { name: 'Extérieur' }))

      expect(sceneOf(useScenes.getState(), 'doc-1').nodes).toHaveLength(3)
    })

    // A stored name would go on claiming « Night » after the first field moved, which is why the
    // chip reads the world back rather than remembering what was clicked.
    it('reads back as chosen, and stops once anything it set is tuned', async () => {
      render(<Content />)
      await userEvent.click(screen.getByRole('button', { name: 'Nuit' }))
      expect(screen.getByRole('button', { name: 'Nuit' })).toHaveAttribute('aria-pressed', 'true')

      await userEvent.click(screen.getByRole('button', { name: 'Transparent' }))

      expect(screen.getByRole('button', { name: 'Nuit' })).toHaveAttribute('aria-pressed', 'false')
    })

    it('comes back with one undo', async () => {
      render(<Content />)
      await userEvent.click(screen.getByRole('button', { name: 'Nuit' }))
      useScenes.getState().undo('doc-1')

      expect(world().toneMapping).toBe('none')
      expect(world().background).toEqual({ kind: 'environment' })
    })
  })

  describe('isolation', () => {
    it('restores the exact visibility that went in, and not all-visible', async () => {
      render(<Content />)

      await userEvent.click(screen.getByRole('button', { name: 'Isoler' }))
      expect(drawsNode(view().isolation, 'a', true)).toBe(true)
      expect(drawsNode(view().isolation, 'c', true)).toBe(false)

      await userEvent.click(screen.getByRole('button', { name: /Quitter/ }))
      expect(drawsNode(view().isolation, 'a', true)).toBe(true)
      expect(drawsNode(view().isolation, 'c', true)).toBe(true)
      // The one the document hides, which « show all » must never bring back.
      expect(drawsNode(view().isolation, 'b', false)).toBe(false)
    })

    // Hiding for the viewport is not hiding in the document: nothing here reaches the file.
    it('never writes the visibility a document holds', async () => {
      render(<Content />)
      await userEvent.click(screen.getByRole('button', { name: /Masquer/ }))

      expect(sceneOf(useScenes.getState(), 'doc-1').nodes.map(node => node.visible)).toEqual([
        true,
        false,
        true,
      ])
    })

    it('gives everything back with show all', async () => {
      render(<Content />)
      await userEvent.click(screen.getByRole('button', { name: /Masquer/ }))
      await userEvent.click(screen.getByRole('button', { name: /Tout afficher/ }))

      expect(drawsNode(view().isolation, 'a', true)).toBe(true)
    })
  })

  describe('contextual fields', () => {
    it('offers the fog numbers only once a fog is chosen', async () => {
      render(<Content />)
      await userEvent.click(screen.getByRole('button', { name: /Atmosphère/ }))
      expect(screen.queryByTitle('Densité')).not.toBeInTheDocument()

      await userEvent.click(screen.getByRole('button', { name: 'Exponentiel' }))
      expect(screen.getByTitle('Densité')).toBeInTheDocument()
    })

    // The backdrop section opens with the panel, so nothing has to be unfolded to reach it.
    it('offers a backdrop colour only for a colour backdrop', async () => {
      render(<Content />)
      expect(screen.queryByTitle('Couleur du fond')).not.toBeInTheDocument()

      await userEvent.click(screen.getByRole('button', { name: 'Couleur' }))
      expect(screen.getByTitle('Couleur du fond')).toBeInTheDocument()
    })

    it('offers the snap steps only while snapping is on', async () => {
      render(<Content />)
      await userEvent.click(screen.getByRole('button', { name: /Guides et magnétisme/ }))
      expect(screen.queryByTitle('Déplacement')).not.toBeInTheDocument()

      await userEvent.click(screen.getByRole('checkbox', { name: 'Magnétisme' }))
      expect(screen.getByTitle('Déplacement')).toBeInTheDocument()
    })
  })
})
