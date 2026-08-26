import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { DEFAULT_WORLD } from '@shared/domain/scene'
import { meshNode } from '@/engines/scene/scene-fixtures'
import { EMPTY_SCENE, type SceneState } from '@/engines/scene/sceneState'
import { installFakeBridge } from '@/services/fakeBridge'
import { installScene } from '@/stores/scene-fixtures'
import { sceneOf, useScenes } from '@/stores/scenes'
import { useSceneViews } from '@/stores/sceneViews'
import { useSettings } from '@/stores/settings'
import { definition } from '..'

const { Content } = definition

/** Three meshes, one hidden by its author: what a look settles must reach none of them. */
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

describe('environment panel', () => {
  beforeEach(() => {
    installFakeBridge()
    useSettings.setState({ settings: DEFAULT_SETTINGS })
    useSceneViews.setState({ views: {} })
    installTwo()
  })

  it('lights a scene the studio way until somebody says otherwise', () => {
    render(<Content />)

    expect(screen.getByRole('combobox', { name: 'Source' })).toHaveValue('studio')
    expect(world().environment).toEqual({ kind: 'studio' })
  })

  describe('looks', () => {
    it('writes the fields the look is about', async () => {
      render(<Content />)
      await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Ambiances' }), 'night')

      expect(world().toneMapping).toBe('aces')
      expect(world().exposure).toBeGreaterThan(1)
      expect(world().background).toEqual({ kind: 'color', color: '#0b0e14' })
    })

    // A look settles the environment, never the scene: adding a sun would put a row in the
    // outliner, an entry in the history and a light in every export.
    it('adds no node to the scene', async () => {
      render(<Content />)
      await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Ambiances' }), 'outdoor')

      expect(sceneOf(useScenes.getState(), 'doc-1').nodes).toHaveLength(3)
    })

    // A stored name would go on claiming « Night » after the first field moved, which is why the
    // row reads the world back rather than remembering what was chosen.
    it('reads back as chosen, and falls to « custom » once anything it set is tuned', async () => {
      render(<Content />)
      const looks = screen.getByRole('combobox', { name: 'Ambiances' })
      await userEvent.selectOptions(looks, 'night')
      expect(looks).toHaveValue('night')

      await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Fond' }), 'transparent')

      expect(looks).toHaveValue('')
      expect(screen.getByRole('option', { name: 'Personnalisé' })).toBeDisabled()
    })

    it('comes back with one undo', async () => {
      render(<Content />)
      await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Ambiances' }), 'night')
      useScenes.getState().undo('doc-1')

      expect(world().toneMapping).toBe('none')
      expect(world().background).toEqual({ kind: 'environment', blur: 0 })
    })
  })

  // The four ACT rather than describe, and framing was a plain duplicate of the bar's own — which
  // is why all four are named here, not the two that were easiest to assert.
  it('leaves the four visibility commands to the toolbar', () => {
    render(<Content />)

    for (const name of [/Cadrer/, /Isoler/, /Masquer/, /Tout afficher/]) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
    }
  })

  describe('contextual fields', () => {
    it('offers the fog numbers only once a fog is chosen', async () => {
      render(<Content />)
      await userEvent.click(screen.getByRole('button', { name: /Atmosphère/ }))
      expect(screen.queryByTitle('Densité')).not.toBeInTheDocument()

      await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Brouillard' }), 'exp2')
      expect(screen.getByTitle('Densité')).toBeInTheDocument()
    })

    // The backdrop section opens with the panel, so nothing has to be unfolded to reach it.
    it('offers a backdrop colour only for a colour backdrop', async () => {
      render(<Content />)
      expect(screen.queryByTitle('Couleur du fond')).not.toBeInTheDocument()

      await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Fond' }), 'color')
      expect(screen.getByTitle('Couleur du fond')).toBeInTheDocument()
    })

    // Softening a backdrop that is the procedural studio would soften nothing: there is no
    // picture to blur, only light.
    it('offers the backdrop softening under a sky, and not under the studio', () => {
      render(<Content />)
      expect(screen.queryByTitle('Flou du fond')).not.toBeInTheDocument()

      cleanup()
      installScene('doc-1', {
        ...installTwo(),
        world: { ...DEFAULT_WORLD, environment: { kind: 'skybox', assetId: 'sky-1' } },
      })
      render(<Content />)

      expect(screen.getByTitle('Flou du fond')).toBeInTheDocument()
    })

    it('offers the snap steps once any one snap is on', async () => {
      render(<Content />)
      await userEvent.click(screen.getByRole('button', { name: /Guides et magnétisme/ }))
      expect(screen.queryByTitle('Déplacement')).not.toBeInTheDocument()

      await userEvent.click(screen.getByRole('checkbox', { name: 'Magnétisme d’angle' }))
      expect(screen.getByTitle('Déplacement')).toBeInTheDocument()
    })

    /**
     * 🛑 The steps read `0.5` here while the viewport read `0,5 m` for the same preference:
     * this panel formatted them with `String`, having its own table of the three kinds.
     */
    it('reads a step the way the viewport does, unit and all', async () => {
      render(<Content />)
      await userEvent.click(screen.getByRole('button', { name: /Guides et magnétisme/ }))
      await userEvent.click(screen.getByRole('checkbox', { name: 'Magnétisme d’angle' }))

      expect(screen.getByLabelText('Déplacement')).toHaveDisplayValue('0,5 m')
      expect(screen.getByLabelText('Rotation')).toHaveDisplayValue('15°')
    })
  })
})
