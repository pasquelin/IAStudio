import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cameraNode } from '@/engines/scene/node-factory'
import { meshNode, modelNodeFixture } from '@/engines/scene/scene-fixtures'
import type { SceneRenderer } from '@/engines/scene/SceneRenderer'
import { installFakeBridge } from '@/services/fake-bridge'
import { forgetSceneEngine, registerSceneEngine } from '@/stores/scene-engines'
import { EMPTY_SCENE } from '@/engines/scene/scene-state'
import { installScene } from '@/stores/scene-fixtures'
import { useModelClips } from '@/stores/model-clips'
import { useSceneViews } from '@/stores/scene-views'
import { animationViewOf, useAnimationViews } from '@/stores/animation-view'
import { historyOf, sceneOf, useScenes } from '@/stores/scenes'
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
    const before = historyOf(useScenes.getState(), DOCUMENT).past.length

    await userEvent.click(
      within(screen.getByTestId('anim-subject-cube-1')).getByRole('button', {
        name: /Poser une clé sur/,
      }),
    )

    expect(historyOf(useScenes.getState(), DOCUMENT).past).toHaveLength(before + 1)
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

  it('records with auto-key, and keeps the switch off the undo stack', async () => {
    render(<AnimationPanel documentId={DOCUMENT} />)
    const before = historyOf(useScenes.getState(), DOCUMENT).past.length

    await userEvent.click(screen.getByRole('button', { name: /Enregistrement automatique/ }))

    expect(animationViewOf(useAnimationViews.getState(), DOCUMENT).autoKey).toBe(true)
    expect(historyOf(useScenes.getState(), DOCUMENT).past).toHaveLength(before)
  })

  it('sets the duration and the rate, which nothing could reach before', async () => {
    render(<AnimationPanel documentId={DOCUMENT} />)

    await userEvent.tripleClick(screen.getByLabelText(/Images\/s/))
    await userEvent.keyboard('30{Enter}')

    expect(timelineOf().fps).toBe(30)
  })

  it('runs the head back to the start', async () => {
    useSceneViews.getState().setPlayhead(DOCUMENT, 2_000_000)
    render(<AnimationPanel documentId={DOCUMENT} />)
    await userEvent.click(screen.getByRole('button', { name: /Revenir au début/ }))

    expect(screen.getByText('00:00:00:00')).toBeInTheDocument()
  })

  it('switches between playing and paused', async () => {
    render(<AnimationPanel documentId={DOCUMENT} />)
    await userEvent.click(screen.getByRole('button', { name: /^Lire/ }))

    expect(screen.getByRole('button', { name: /Mettre en pause/ })).toBeInTheDocument()
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

  it('offers no bone picker for a model that brought none', () => {
    render(<AnimationPanel documentId={DOCUMENT} />)

    expect(screen.queryByLabelText('Os')).not.toBeInTheDocument()
  })

  it('offers every bone the file brought, plus the model as a whole', () => {
    useModelClips.setState({ bones: { [DOCUMENT]: { perso: ['spine', 'arm.L'] } } })
    render(<AnimationPanel documentId={DOCUMENT} />)

    expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual([
      'Le modèle entier',
      'spine',
      'arm.L',
    ])
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

describe('writing the film', () => {
  const withCamera = (): void => {
    installScene(DOCUMENT, {
      ...EMPTY_SCENE,
      nodes: [meshNode('cube-1'), cameraNode()],
      selectedIds: ['cube-1'],
    })
  }

  /** A stand-in for the engine: there is no WebGL here, and what is under test is the wiring. */
  function installEngine(renderFilm = vi.fn(() => Promise.resolve())): typeof renderFilm {
    registerSceneEngine(DOCUMENT, { renderFilm } as unknown as SceneRenderer)
    return renderFilm
  }

  afterEach(() => forgetSceneEngine(DOCUMENT))

  it('says a scene without a camera has nothing to render from', () => {
    withSelectedCube()
    render(<AnimationPanel documentId={DOCUMENT} />)

    expect(screen.getByRole('button', { name: /Rendre en vidéo/ })).toBeDisabled()
  })

  it('asks where the film goes, then draws it, then encodes it', async () => {
    withCamera()
    const renderFilm = installEngine()
    const start = vi.fn(() => Promise.resolve('render_1'))
    const finish = vi.fn(() => Promise.resolve('set.mp4'))
    installFakeBridge({ render: { start, finish } })

    render(<AnimationPanel documentId={DOCUMENT} />)
    await userEvent.click(screen.getByRole('button', { name: /Rendre en vidéo/ }))

    expect(start).toHaveBeenCalledWith({ name: expect.any(String), fps: timelineOf().fps })
    expect(renderFilm).toHaveBeenCalled()
    expect(finish).toHaveBeenCalledWith('render_1')
  })

  it('draws nothing at all when the save dialog is dismissed', async () => {
    withCamera()
    const renderFilm = installEngine()
    installFakeBridge({ render: { start: () => Promise.resolve(null) } })

    render(<AnimationPanel documentId={DOCUMENT} />)
    await userEvent.click(screen.getByRole('button', { name: /Rendre en vidéo/ }))

    expect(renderFilm).not.toHaveBeenCalled()
  })

  it('cancels the session when the drawing fails, rather than leaving frames behind', async () => {
    withCamera()
    installEngine(vi.fn(() => Promise.reject(new Error('context lost'))))
    const cancel = vi.fn(() => Promise.resolve())
    installFakeBridge({ render: { start: () => Promise.resolve('render_1'), cancel } })

    render(<AnimationPanel documentId={DOCUMENT} />)
    await userEvent.click(screen.getByRole('button', { name: /Rendre en vidéo/ }))

    expect(cancel).toHaveBeenCalledWith('render_1')
  })
})
