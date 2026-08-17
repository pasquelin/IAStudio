import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { meshNode, modelNodeFixture } from '@/engines/scene/scene-fixtures'
import { EMPTY_SCENE } from '@/engines/scene/sceneState'
import { setTimelineSettings } from '@/engines/scene/animationCommands'
import { SECOND } from '@shared/domain/time'
import { installScene } from '@/stores/scene-fixtures'
import { useSceneViews } from '@/stores/sceneViews'
import { useAnimationViews } from '@/stores/animationView'
import { useModelClips } from '@/stores/modelClips'
import { sceneHistoryOf, sceneOf, useScenes } from '@/stores/scenes'
import { AnimationPanel } from './AnimationPanel'

const DOCUMENT = 'doc-1'

const timelineOf = () => sceneOf(useScenes.getState(), DOCUMENT).animation
const tracks = () => timelineOf().tracks

/** A scene with one cube, picked — which is what the add buttons read. */
function withSelectedCube(): void {
  installScene(DOCUMENT, {
    ...EMPTY_SCENE,
    nodes: [meshNode('cube-1')],
    selectedIds: ['cube-1'],
  })
}

describe('AnimationPanel', () => {
  beforeEach(() => {
    withSelectedCube()
    useSceneViews.setState({ views: {} })
    useAnimationViews.setState({ views: {} })
  })

  it('shows the object of the scene straight away, with nothing to create first', () => {
    render(<AnimationPanel documentId={DOCUMENT} />)

    expect(screen.getByTestId('anim-subject-cube-1')).toHaveTextContent('cube-1')
  })

  it('offers no button to add a track, because there is nothing to add', () => {
    render(<AnimationPanel documentId={DOCUMENT} />)

    expect(screen.queryByRole('button', { name: /Ajouter une piste/ })).not.toBeInTheDocument()
  })

  it('keys an object that holds no channel yet, creating the three it needs', async () => {
    render(<AnimationPanel documentId={DOCUMENT} />)

    await userEvent.click(
      within(screen.getByTestId('anim-subject-cube-1')).getByRole('button', {
        name: /Poser une clé sur/,
      }),
    )

    expect(tracks().map(track => track.target.property)).toEqual(['position', 'rotation', 'scale'])
    expect(tracks().every(track => track.keys.length === 1)).toBe(true)
  })

  it('costs ONE undo for a key that had to open its channels', async () => {
    render(<AnimationPanel documentId={DOCUMENT} />)
    const before = sceneHistoryOf(useScenes.getState(), DOCUMENT).past.length

    await userEvent.click(
      within(screen.getByTestId('anim-subject-cube-1')).getByRole('button', {
        name: /Poser une clé sur/,
      }),
    )

    expect(sceneHistoryOf(useScenes.getState(), DOCUMENT).past).toHaveLength(before + 1)
  })

  it('keys a scale at one, not zero — a neutral key must not flatten the object', async () => {
    render(<AnimationPanel documentId={DOCUMENT} />)

    await userEvent.click(
      within(screen.getByTestId('anim-subject-cube-1')).getByRole('button', {
        name: /Poser une clé sur/,
      }),
    )

    const scale = tracks().find(track => track.target.property === 'scale')
    expect(scale?.keys[0]?.value).toEqual({ x: 1, y: 1, z: 1 })
  })

  it('unfolds the channels once they exist, and folds them back', async () => {
    render(<AnimationPanel documentId={DOCUMENT} />)
    await userEvent.click(
      within(screen.getByTestId('anim-subject-cube-1')).getByRole('button', {
        name: /Poser une clé sur/,
      }),
    )

    const fold = () =>
      within(screen.getByTestId('anim-subject-cube-1')).getByRole('button', { name: 'cube-1' })
    const channel = () => screen.queryByTestId('anim-channel-' + (tracks()[0]?.id ?? ''))

    await userEvent.click(fold())
    expect(channel()).toBeInTheDocument()

    await userEvent.click(fold())
    expect(channel()).not.toBeInTheDocument()
  })
})

describe('AnimationPanel and the bones of a rig', () => {
  beforeEach(() => {
    installScene(DOCUMENT, {
      ...EMPTY_SCENE,
      nodes: [modelNodeFixture('perso')],
      selectedIds: ['perso'],
    })
    useSceneViews.setState({ views: {} })
    useModelClips.setState({ clips: {}, bones: {} })
  })

  it('keys the model itself, on its own line', async () => {
    useModelClips.setState({ bones: { [DOCUMENT]: { perso: ['spine', 'arm.L'] } } })
    render(<AnimationPanel documentId={DOCUMENT} />)

    await userEvent.click(
      within(screen.getByTestId('anim-subject-perso')).getByRole('button', {
        name: /Poser une clé sur/,
      }),
    )

    expect(tracks().map(track => track.target)).toEqual([
      { nodeId: 'perso', property: 'position' },
      { nodeId: 'perso', property: 'rotation' },
      { nodeId: 'perso', property: 'scale' },
    ])
  })
})

describe('a head left outside the band', () => {
  beforeEach(() => {
    withSelectedCube()
    useSceneViews.setState({ views: {} })
    useAnimationViews.setState({ views: {} })
  })

  const shorten = (seconds: number): void => {
    useScenes.getState().runCommand(DOCUMENT, setTimelineSettings({ duration: seconds * SECOND }))
  }

  it('is pulled back in when the band is shortened under it', () => {
    useSceneViews.getState().setPlayhead(DOCUMENT, 4 * SECOND)
    render(<AnimationPanel documentId={DOCUMENT} />)

    act(() => shorten(2))

    // Left at four, the head would stand where no key can, and Play would stop on the frame it
    // starts on — the very defect the rewind was added to close.
    expect(useSceneViews.getState().views[DOCUMENT]?.playhead).toBe(2 * SECOND)
  })

  it('leaves a head that already fits exactly where it is', () => {
    useSceneViews.getState().setPlayhead(DOCUMENT, 1 * SECOND)
    render(<AnimationPanel documentId={DOCUMENT} />)

    act(() => shorten(3))

    expect(useSceneViews.getState().views[DOCUMENT]?.playhead).toBe(1 * SECOND)
  })
})

describe('the request, clause by clause', () => {
  beforeEach(() => {
    withSelectedCube()
    useSceneViews.setState({ views: {} })
    useAnimationViews.setState({ views: {} })
  })

  it('« voir mes objets » — every object of the scene has its line, unprompted', () => {
    installScene(DOCUMENT, {
      ...EMPTY_SCENE,
      nodes: [meshNode('cube-1'), meshNode('sphere-1')],
      selectedIds: [],
    })
    render(<AnimationPanel documentId={DOCUMENT} />)

    expect(screen.getByTestId('anim-subject-cube-1')).toBeInTheDocument()
    expect(screen.getByTestId('anim-subject-sphere-1')).toBeInTheDocument()
  })

  it('« mettre des points clés » — one press keys the object, whatever it held before', async () => {
    render(<AnimationPanel documentId={DOCUMENT} />)

    await userEvent.click(
      within(screen.getByTestId('anim-subject-cube-1')).getByRole('button', {
        name: /Poser une clé sur/,
      }),
    )

    expect(tracks()).toHaveLength(3)
    expect(tracks().every(track => track.keys.length === 1)).toBe(true)
  })

  it('nothing asks to CREATE anything before the objects can be seen', () => {
    render(<AnimationPanel documentId={DOCUMENT} />)

    expect(screen.queryByRole('button', { name: /Ajouter une piste/ })).not.toBeInTheDocument()
    // And the word the montage uses has no place here: an object of a scene exists already.
    expect(screen.queryByText(/Aucune piste/)).not.toBeInTheDocument()
  })
})
