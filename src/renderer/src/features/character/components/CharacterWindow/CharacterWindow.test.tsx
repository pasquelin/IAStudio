import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { act } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { SceneRendererOptions } from '@/engines/scene/SceneRenderer'
import { installFakeBridge } from '@/services/fakeBridge'
import { clearCharacters } from '@/stores/character-fixtures'
import { useCharacterView } from '@/stores/characterView'
import { CharacterWindow } from './CharacterWindow'

/** Every engine built, so a case can fire the callbacks the real one would. */
const built = vi.hoisted((): SceneRendererOptions[] => [])

vi.mock('@/engines/scene/SceneRenderer', () => ({
  SceneRenderer: class {
    constructor(options: unknown) {
      built.push(options as SceneRendererOptions)
    }

    mount = vi.fn()
    dispose = vi.fn()
    apply = vi.fn()
    configure = vi.fn()
    setSkeletons = vi.fn()
    setPoseMode = vi.fn()
    setMode = vi.fn()
    setPickedBone = vi.fn()
    skinModel = vi.fn()
    frameContents = vi.fn()
  },
}))

const ASSET = 'asset-hero'
const SAMPLE = {
  bounds: { min: { x: -0.3, y: 0, z: -0.2 }, max: { x: 0.3, y: 1.8, z: 0.2 } },
  points: new Float32Array(),
}

beforeEach(() => {
  built.length = 0
  clearCharacters()
  installFakeBridge()
})

afterEach(() => {
  vi.clearAllMocks()
})

// Asked for at the first sight of the window: a joint could be moved and never turned, and the
// only way to say which was to edit the source.
it('offers the ways of acting on a joint, opens on placing one, and offers no scale', async () => {
  render(<CharacterWindow assetId={ASSET} />)

  const bar = screen.getByRole('toolbar')

  expect(within(bar).getAllByRole('button')).toHaveLength(3)
  // A joint is a point and a length: there is nothing about one to enlarge.
  expect(within(bar).queryByRole('button', { name: /échelle/i })).toBeNull()
  expect(within(bar).getByRole('button', { pressed: true })).toHaveAccessibleName(/Déplacer/)

  await userEvent.click(within(bar).getByRole('button', { name: /Pivoter/ }))

  expect(useCharacterView.getState().mode).toBe('rotate')
})

// The sentence is about the FILE landing, and a mesh with no skeleton is a character plainly on
// screen — the panel beside it offers to rig it. Shown on « no rig » it stood over the model.
it('drops the waiting note as soon as the engine has measured the mesh', async () => {
  render(<CharacterWindow assetId={ASSET} />)

  expect(screen.getByText('En attente du personnage…')).toBeInTheDocument()

  await act(async () => {
    built[0]?.onCharacter?.('node-1', null, {}, SAMPLE)
  })

  expect(screen.queryByText('En attente du personnage…')).not.toBeInTheDocument()
})
