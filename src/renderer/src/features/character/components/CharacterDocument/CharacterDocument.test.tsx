import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { act } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { IDENTITY_TRANSFORM, type Transform } from '@shared/domain/transform'
import type { Rig } from '@shared/domain/rig'
import type { SceneRendererOptions } from '@/engines/scene/SceneRenderer'
import { installFakeBridge } from '@/services/fakeBridge'
import { characterOf, seedCharacter, useCharacters } from '@/stores/character'
import { clearCharacters, installCharacterDocument } from '@/stores/character-fixtures'
import { characterViewOf, useCharacterView } from '@/stores/characterView'
import { useAnimationViews } from '@/stores/animationView'
import { useSettings } from '@/stores/settings'
import { CharacterDocument } from './CharacterDocument'

/** Every engine built, so a case can fire the callbacks the real one would. */
const built = vi.hoisted((): SceneRendererOptions[] => [])

/** Every bone the engine was asked to POSE, which is the gesture that writes nothing. */
const posed = vi.hoisted((): string[] => [])

/** Every set of held axes the engine was handed — what a joint may not leave while dragged. */
const holds = vi.hoisted((): string[][] => [])

/** What each export was asked to carry of the studio's own — the band, for a motion. */
const carried = vi.hoisted((): (Record<string, unknown> | null)[] => [])

/** Every set of directions the keyboard handed the camera. */
const flown = vi.hoisted((): string[][] => [])

/** Whether the persistent flight was armed, each time it was said. */
const navigated = vi.hoisted((): boolean[] => [])

/** Every viewport dressing handed to the engine, in order — the decor AND the navigation. */
const configured = vi.hoisted((): Record<string, unknown>[] => [])

vi.mock('@/engines/scene/SceneRenderer', () => ({
  SceneRenderer: class {
    constructor(options: unknown) {
      built.push(options as SceneRendererOptions)
    }

    mount = vi.fn()
    dispose = vi.fn()
    apply = vi.fn()
    configure = (next: Record<string, unknown>) => {
      configured.push(next)
    }
    setSkeletons = vi.fn()
    setPoseMode = vi.fn()
    setSculptMode = vi.fn()
    setMode = vi.fn()
    setPickedBone = vi.fn()
    setRestEditing = vi.fn()
    setHeldBoneAxes = (axes: readonly string[]) => {
      holds.push([...axes])
    }
    poseBone = (_nodeId: string, bone: string) => {
      posed.push(bone)
    }
    skinModel = vi.fn()
    frameContents = vi.fn()
    meshSample = vi.fn()
    // A flight is under way, which is the one state a motion key is read in.
    flying = true
    setMotion = (held: Set<string>) => {
      flown.push([...held])
    }
    setNavigating = (on: boolean) => {
      navigated.push(on)
    }
    // What the clock pushes into the engine: the head, and what a block is being watched on.
    setPlayhead = vi.fn()
    setPreview = vi.fn()
    exportTo = (_format: string, _scope: string, extras?: Record<string, unknown>) => {
      carried.push(extras ?? null)
      return Promise.resolve(new Uint8Array([1, 2]))
    }
  },
}))

const ASSET = 'asset-hero'
const DOCUMENT = 'doc-hero'

/** The tab, on the model it was opened from — what the dock and the shell both address it by. */
const showTab = (): void => {
  installCharacterDocument(DOCUMENT, ASSET)
  render(<CharacterDocument documentId={DOCUMENT} />)
}

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
  flown.length = 0
  navigated.length = 0
  holds.length = 0
  carried.length = 0
  configured.length = 0
  clearCharacters()
  // The whole view, never the one flag a case happens to read: a padlock left closed by the case
  // before was what made the next one pass, and the leak showed only when the bar moved.
  useCharacterView.setState({ views: {} })
  useAnimationViews.setState({ views: {} })
  installFakeBridge()
})

afterEach(() => {
  vi.clearAllMocks()
})

/**
 * A rig is EDITED here, gizmo and selection and all, so how the view turns belongs to the person
 * — while the decor stays this window's own, which is bones on a grid and none of the studio's
 * helpers. The window used to freeze both halves on the defaults.
 */
it('follows the person on how the view turns, and nothing else of the studio', async () => {
  showTab()
  await waitFor(() => expect(configured.length).toBeGreaterThan(0))

  // Changed while the window is OPEN, which is how a preference is changed: the settings live in
  // another window, and this one must not have to be closed for the change to land.
  act(() =>
    useSettings.setState(state => ({
      settings: { ...state.settings, three: { ...state.settings.three, orbitUnderCursor: true } },
    })),
  )

  await waitFor(() => expect(configured.at(-1)?.orbitUnderCursor).toBe(true))
  // Its own decor all the same, untouched by what the studio happens to show.
  expect(configured.at(-1)?.showGrid).toBe(true)
  expect(configured.at(-1)?.lightHelpers).toBe('off')
})

// Asked for at the first sight of the window: a joint could be moved and never turned, and the
// only way to say which was to edit the source.
it('offers the ways of acting on a joint, opens on placing one, and offers no scale', async () => {
  showTab()

  const bar = screen.getByRole('toolbar', { name: 'Outils du squelette' })

  // Three verbs and the two states. No padlock on the lengths: posing turns the bone arriving at
  // a joint, and editing a skeleton is where one shortens a bone that came out too long.
  expect(within(bar).getAllByRole('button')).toHaveLength(5)
  expect(within(bar).queryByRole('button', { name: /longueurs/i })).toBeNull()
  // A joint is a point and a length: there is nothing about one to enlarge.
  expect(within(bar).queryByRole('button', { name: /échelle/i })).toBeNull()
  // The armed verb, which is the one the gizmo obeys — the lock beside it is pressed too.
  expect(within(bar).getByRole('button', { name: /Déplacer/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  )

  await userEvent.click(within(bar).getByRole('button', { name: /Pivoter/ }))

  expect(characterViewOf(useCharacterView.getState(), ASSET).mode).toBe('rotate')
})

/**
 * 🛑 Exactly one lit, never two: drawn as a pair of free toggles they both took the accent and
 * read as two modes at once — « soit je place l'articulation, soit je joue avec le modèle ».
 */
it('lights one state at a time, and hands the held axes to the engine', async () => {
  showTab()
  const bar = screen.getByRole('toolbar', { name: 'Outils du squelette' })
  const pressedIn = () =>
    within(bar)
      .getAllByRole('button')
      .filter(one => one.getAttribute('aria-pressed') === 'true')
      .map(one => one.getAttribute('aria-label'))

  expect(pressedIn()).toEqual(['Déplacer', 'Manipuler'])
  // 🛑 The engine, not just the store: a padlock applied on release alone lets a joint leave the
  // axis a hand meant to keep it on for the whole of a gesture.
  expect(holds.at(-1)).toEqual([])

  await userEvent.click(within(bar).getByRole('button', { name: /squelette/i }))

  expect(pressedIn()).toEqual(['Déplacer', 'Modifier le squelette'])
  expect(characterViewOf(useCharacterView.getState(), ASSET).editingRest).toBe(true)
})

/**
 * The two gestures of this window, and the bar is the only thing that tells them apart: a bone
 * moved POSES the character — the mesh follows — until the bar says the rest is being edited.
 * Written on both, a joint pulled into the elbow it belongs in took the whole arm with it.
 */
it('poses the bone the gizmo moved, and writes the skeleton only once the bar asks', async () => {
  seedCharacter(ASSET, RIG, {})
  showTab()
  const move = { id: 'node-1', bone: 'Spine', transform: raised(0.2) }

  act(() => built[0]?.onTransform?.([move]))

  expect(posed).toEqual(['Spine'])
  expect(restOfSpine()?.position.y).toBe(0)

  await userEvent.click(
    within(screen.getByRole('toolbar', { name: 'Outils du squelette' })).getByRole('button', {
      name: /squelette/i,
    }),
  )
  // Emptied on purpose: turning the toggle on puts every bone back on its rest through the very
  // same door, and what this half is about is what the NEXT gesture does.
  posed.length = 0
  act(() => built[0]?.onTransform?.([move]))

  expect(posed).toEqual([])
  expect(restOfSpine()?.position.y).toBeCloseTo(0.2, 5)
})

// The sentence is about the FILE landing, and a mesh with no skeleton is a character plainly on
// screen — the panel beside it offers to rig it. Shown on « no rig » it stood over the model.
it('drops the waiting note as soon as the engine has measured the mesh', async () => {
  showTab()

  expect(screen.getByText('En attente du personnage…')).toBeInTheDocument()

  await act(async () => {
    built[0]?.onCharacter?.('node-1', null, {}, SAMPLE)
  })

  expect(screen.queryByText('En attente du personnage…')).not.toBeInTheDocument()
})

/**
 * 🛑 This window wired neither `onMotionChange` nor `isFlying`, so its keys reached no engine at
 * all: it orbited and nothing else, where every other 3D surface of the studio flies.
 */
it('flies the camera on the keys, like the viewport of the studio', async () => {
  showTab()

  await act(async () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', key: 'w' }))
  })

  expect(flown.at(-1)).toEqual(['forward'])

  await act(async () => {
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', key: 'w' }))
  })

  expect(flown.at(-1)).toEqual([])
})

// 🛑 The studio's viewport arms a persistent flight on one key; this window declared two commands
// in all — undo and redo — so nothing here could ever hold the camera without a button pressed.
it('arms the persistent flight on its own key, and disarms it on the next press', async () => {
  showTab()

  await act(async () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Backquote', key: '`' }))
  })
  expect(navigated.at(-1)).toBe(true)

  await act(async () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Backquote', key: '`' }))
  })
  expect(navigated.at(-1)).toBe(false)
})

/**
 * 🛑 The engine leaves the flight on its own — Escape, a lost pointer capture. Unheard, the
 * window's state stayed armed and the next press of the key disarmed a mode already over: the
 * first press after an Escape did nothing at all.
 */
it('arms the flight again after the engine has left it on its own', async () => {
  showTab()

  await act(async () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Backquote', key: '`' }))
  })
  expect(navigated.at(-1)).toBe(true)

  await act(async () => {
    built.at(-1)?.onNavigatingChange?.(false)
  })

  await act(async () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Backquote', key: '`' }))
  })

  expect(navigated.at(-1)).toBe(true)
})
