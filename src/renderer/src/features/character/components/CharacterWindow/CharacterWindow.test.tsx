import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { act } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { IDENTITY_TRANSFORM, type Transform } from '@shared/domain/transform'
import type { Rig } from '@shared/domain/rig'
import type { BoneHold } from '@/engines/character/boneRest'
import type { SceneRendererOptions } from '@/engines/scene/SceneRenderer'
import { installFakeBridge } from '@/services/fakeBridge'
import { characterOf, seedCharacter, useCharacters } from '@/stores/character'
import { clearCharacters } from '@/stores/character-fixtures'
import { useCharacterView } from '@/stores/characterView'
import { CharacterWindow } from './CharacterWindow'

/** Every engine built, so a case can fire the callbacks the real one would. */
const built = vi.hoisted((): SceneRendererOptions[] => [])

/** Every bone the engine was asked to POSE, which is the gesture that writes nothing. */
const posed = vi.hoisted((): string[] => [])

/** Every hold the engine was handed — what a joint is kept within for the whole of a drag. */
const holds = vi.hoisted((): BoneHold[] => [])

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
    setRestEditing = vi.fn()
    setBoneHold = (hold: BoneHold) => {
      holds.push(hold)
    }
    poseBone = (_nodeId: string, bone: string) => {
      posed.push(bone)
    }
    skinModel = vi.fn()
    frameContents = vi.fn()
  },
}))

const ASSET = 'asset-hero'
const SAMPLE = {
  bounds: { min: { x: -0.3, y: 0, z: -0.2 }, max: { x: 0.3, y: 1.8, z: 0.2 } },
  points: new Float32Array(),
}

const raised = (y: number): Transform => ({
  ...IDENTITY_TRANSFORM,
  position: { x: 0, y, z: 0 },
})

/** One bone, so a case can read back what a gesture wrote into the skeleton of the file. */
const RIG: Rig = {
  origin: 'local',
  bones: [{ name: 'Spine', parent: null, rest: IDENTITY_TRANSFORM }],
}

const restOfSpine = (): Transform | undefined =>
  characterOf(useCharacters.getState(), ASSET).rig?.bones[0]?.rest

beforeEach(() => {
  built.length = 0
  posed.length = 0
  holds.length = 0
  clearCharacters()
  // The whole view, never the one flag a case happens to read: a padlock left closed by the case
  // before was what made the next one pass, and the leak showed only when the bar moved.
  useCharacterView.setState({
    editingRest: false,
    lockedLengths: true,
    heldAxes: [],
    pickedBone: null,
    mode: 'translate',
  })
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

  // Three verbs and the one toggle that qualifies them: the padlock belongs to editing a
  // skeleton, and posing articulates, so a bone keeps its length with nothing to ask for.
  expect(within(bar).getAllByRole('button')).toHaveLength(4)
  expect(within(bar).queryByRole('button', { name: /longueurs/i })).toBeNull()
  // A joint is a point and a length: there is nothing about one to enlarge.
  expect(within(bar).queryByRole('button', { name: /échelle/i })).toBeNull()
  // The armed verb, which is the one the gizmo obeys — the lock beside it is pressed too.
  expect(within(bar).getByRole('button', { name: /Déplacer/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  )

  await userEvent.click(within(bar).getByRole('button', { name: /Pivoter/ }))

  expect(useCharacterView.getState().mode).toBe('rotate')
})

// Refused on sight: a hand asking for a hundred pixels stretched a bone to the floor.
it('holds the bone lengths from the first frame, and lets go of them on the bar', async () => {
  useCharacterView.setState({ editingRest: true })
  render(<CharacterWindow assetId={ASSET} />)

  const lock = within(screen.getByRole('toolbar')).getByRole('button', { name: /longueurs/i })

  expect(useCharacterView.getState().lockedLengths).toBe(true)
  // 🛑 The engine, not just the store: the leash is what keeps a joint on its parent for the
  // whole of a drag, and one applied on release alone lets the bone leave the body meanwhile.
  expect(holds.at(-1)).toEqual({ heldAxes: [], lockedLengths: true })

  await userEvent.click(lock)

  expect(useCharacterView.getState().lockedLengths).toBe(false)
  expect(holds.at(-1)).toEqual({ heldAxes: [], lockedLengths: false })
})

/**
 * The two gestures of this window, and the bar is the only thing that tells them apart: a bone
 * moved POSES the character — the mesh follows — until the bar says the rest is being edited.
 * Written on both, a joint pulled into the elbow it belongs in took the whole arm with it.
 */
it('poses the bone the gizmo moved, and writes the skeleton only once the bar asks', async () => {
  // Open, or the leash would pull a bone whose rest is the identity back onto its parent: this
  // case is about which door a gesture takes, not about what the padlock holds.
  useCharacterView.setState({ lockedLengths: false })
  seedCharacter(ASSET, RIG, {})
  render(<CharacterWindow assetId={ASSET} />)
  const move = { id: 'node-1', bone: 'Spine', transform: raised(0.2) }

  act(() => built[0]?.onTransform?.([move]))

  expect(posed).toEqual(['Spine'])
  expect(restOfSpine()?.position.y).toBe(0)

  await userEvent.click(within(screen.getByRole('toolbar')).getByRole('button', { name: /repos/i }))
  // Emptied on purpose: turning the toggle on puts every bone back on its rest through the very
  // same door, and what this half is about is what the NEXT gesture does.
  posed.length = 0
  act(() => built[0]?.onTransform?.([move]))

  expect(posed).toEqual([])
  expect(restOfSpine()?.position.y).toBeCloseTo(0.2, 5)
})

// Without it, laying a motion by hand is out of reach — and posing a character is what the
// gizmo now does. The studio's own band, on this window's workshop scene.
it('stands a band under the character, on the scene of its workshop', () => {
  render(<CharacterWindow assetId={ASSET} />)

  expect(screen.getByRole('region', { name: 'Mouvement en cours' })).toBeInTheDocument()
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
