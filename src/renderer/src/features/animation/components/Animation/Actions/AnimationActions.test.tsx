import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SECOND } from '@shared/domain/time'
import { cameraShot } from '@/engines/scene/animation-fixtures'
import { cameraNode } from '@/engines/scene/nodeFactory'
import {
  cameraNodeFixture,
  meshNode,
  modelNodeFixture,
  rigStateFixture,
} from '@/engines/scene/scene-fixtures'
import type { SceneRenderer } from '@/engines/scene/SceneRenderer'
import { EMPTY_SCENE } from '@/engines/scene/sceneState'
import { installFakeBridge } from '@/services/fakeBridge'
import { animationViewOf, useAnimationViews } from '@/stores/animationView'
import { retitleDocument } from '@/stores/document-fixtures'
import { useModelFiles } from '@/stores/modelFiles'
import { forgetSceneEngine, registerSceneEngine } from '@/stores/sceneEngines'
import { installScene } from '@/stores/scene-fixtures'
import { sceneHistoryOf, sceneOf, useScenes } from '@/stores/scenes'
import { useSceneViews } from '@/stores/sceneViews'
import { AnimationActions } from './AnimationActions'

const DOCUMENT = 'doc-1'

const timelineOf = () => sceneOf(useScenes.getState(), DOCUMENT).animation

/** A scene with one cube, picked — which is what the bone picker reads. */
function withSelectedCube(): void {
  installScene(DOCUMENT, {
    ...EMPTY_SCENE,
    nodes: [meshNode('cube-1')],
    selectedIds: ['cube-1'],
  })
}

const bar = () => render(<AnimationActions documentId={DOCUMENT} />)

describe('the animation bar', () => {
  beforeEach(() => {
    withSelectedCube()
    useSceneViews.setState({ views: {} })
    useAnimationViews.setState({ views: {} })
  })

  it('records with auto-key, and keeps the switch off the undo stack', async () => {
    bar()
    const before = sceneHistoryOf(useScenes.getState(), DOCUMENT).past.length

    await userEvent.click(screen.getByRole('button', { name: /Enregistrement automatique/ }))

    expect(animationViewOf(useAnimationViews.getState(), DOCUMENT).autoKey).toBe(true)
    expect(sceneHistoryOf(useScenes.getState(), DOCUMENT).past).toHaveLength(before)
  })

  it('sets the duration and the rate, which nothing could reach before', async () => {
    bar()

    await userEvent.tripleClick(screen.getByLabelText(/Images\/s/))
    await userEvent.keyboard('30{Enter}')

    expect(timelineOf().fps).toBe(30)
  })

  it('runs the head back to the start', async () => {
    useSceneViews.getState().setPlayhead(DOCUMENT, 2_000_000)
    bar()
    await userEvent.click(screen.getByRole('button', { name: /Retour au début/ }))

    expect(screen.getByText('00:00:00:00')).toBeInTheDocument()
  })

  it('switches between playing and paused', async () => {
    bar()
    await userEvent.click(screen.getByRole('button', { name: /^Lire/ }))

    expect(screen.getByRole('button', { name: /^Pause/ })).toBeInTheDocument()
  })

  it('« comme vidéo et audio » — the band carries a ruler in timecode', () => {
    bar()

    expect(screen.getByText('00:00:00:00')).toBeInTheDocument()
  })
})

describe('typing a duration', () => {
  beforeEach(() => {
    withSelectedCube()
    useSceneViews.setState({ views: {} })
    useAnimationViews.setState({ views: {} })
  })

  it('costs ONE undo for a number typed digit by digit', async () => {
    bar()
    const before = sceneHistoryOf(useScenes.getState(), DOCUMENT).past.length

    const field = screen.getByLabelText(/Images\/s/)
    await userEvent.click(field)
    await userEvent.keyboard('{Backspace}{Backspace}120')
    await userEvent.tab()

    expect(timelineOf().fps).toBe(120)
    expect(sceneHistoryOf(useScenes.getState(), DOCUMENT).past).toHaveLength(before + 1)
  })
})

/**
 * The request this whole panel answers, in the words it was made in: "a timeline like video and
 * audio, seeing my objects on a track, and setting keyframes". One case per clause, so a change
 * that quietly walks away from it fails here rather than at the next screenshot.
 */
describe('the bone picker', () => {
  beforeEach(() => {
    installScene(DOCUMENT, {
      ...EMPTY_SCENE,
      nodes: [modelNodeFixture('perso')],
      selectedIds: ['perso'],
    })
    useSceneViews.setState({ views: {} })
    useModelFiles.setState({ clips: {}, rigs: {}, lengths: {} })
  })

  it('offers no bone picker for a model that brought none', () => {
    bar()

    expect(screen.queryByLabelText('Os')).not.toBeInTheDocument()
  })

  it('offers every bone the file brought, plus the model as a whole', () => {
    useModelFiles.setState({ rigs: { [DOCUMENT]: { perso: rigStateFixture(['spine', 'arm.L']) } } })
    bar()

    expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual([
      'Le modèle entier',
      'spine',
      'arm.L',
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

  /**
   * A stand-in for the engine: there is no WebGL here, and what is under test is the wiring.
   *
   * Typed on the real method's parameters so a case can read back WHAT the film was handed —
   * a stub taking none makes that argument unreachable rather than untyped.
   */
  function installEngine(
    renderFilm = vi.fn((..._film: Parameters<SceneRenderer['renderFilm']>) => Promise.resolve()),
  ): typeof renderFilm {
    registerSceneEngine(DOCUMENT, { renderFilm } as unknown as SceneRenderer)
    return renderFilm
  }

  afterEach(() => forgetSceneEngine(DOCUMENT))

  it('says a scene without a camera has nothing to render from', () => {
    withSelectedCube()
    bar()

    expect(screen.getByRole('button', { name: /Rendre en vidéo/ })).toBeDisabled()
  })

  it('asks where the film goes, then draws it, then encodes it', async () => {
    withCamera()
    const renderFilm = installEngine()
    const start = vi.fn(() => Promise.resolve('render_1'))
    const finish = vi.fn(() => Promise.resolve('set.mp4'))
    installFakeBridge({ render: { start, finish } })

    bar()
    await userEvent.click(screen.getByRole('button', { name: /Rendre en vidéo/ }))

    expect(start).toHaveBeenCalledWith({ name: expect.any(String), fps: timelineOf().fps })
    expect(renderFilm).toHaveBeenCalled()
    expect(finish).toHaveBeenCalledWith('render_1')
  })

  /**
   * A film takes a RESOLVER rather than one camera: the shots hand it over half way, and a fixed
   * camera would write the whole film through whichever one happened to be first.
   */
  it('hands the film a camera per instant rather than one for the whole of it', async () => {
    const first = cameraNodeFixture('cam-a')
    installScene(DOCUMENT, {
      ...EMPTY_SCENE,
      nodes: [first, cameraNodeFixture('cam-b')],
      animation: {
        ...EMPTY_SCENE.animation,
        shots: [
          cameraShot('s1', { cameraId: 'cam-a', start: 0, duration: 7 * SECOND }),
          cameraShot('s2', { cameraId: 'cam-b', start: 7 * SECOND, duration: 8 * SECOND }),
        ],
      },
    })
    const renderFilm = installEngine()
    installFakeBridge({
      render: { start: () => Promise.resolve('render_1'), finish: () => Promise.resolve('a.mp4') },
    })

    bar()
    await userEvent.click(screen.getByRole('button', { name: /Rendre en vidéo/ }))

    const cameraAt = renderFilm.mock.calls[0]?.[0]
    expect([cameraAt?.(3 * SECOND), cameraAt?.(10 * SECOND)]).toEqual(['cam-a', 'cam-b'])
  })

  it('cleans the title down to a file name before the save dialog is asked', async () => {
    withCamera()
    retitleDocument(DOCUMENT, 'Brique 1/2')
    installEngine()
    const start = vi.fn(() => Promise.resolve('render_1'))
    installFakeBridge({ render: { start, finish: () => Promise.resolve('brique.mp4') } })

    bar()
    await userEvent.click(screen.getByRole('button', { name: /Rendre en vidéo/ }))

    expect(start).toHaveBeenCalledWith({ name: 'Brique 1 2', fps: timelineOf().fps })
  })

  it('draws nothing at all when the save dialog is dismissed', async () => {
    withCamera()
    const renderFilm = installEngine()
    installFakeBridge({ render: { start: () => Promise.resolve(null) } })

    bar()
    await userEvent.click(screen.getByRole('button', { name: /Rendre en vidéo/ }))

    expect(renderFilm).not.toHaveBeenCalled()
  })

  it('cancels the session when the drawing fails, rather than leaving frames behind', async () => {
    withCamera()
    installEngine(vi.fn(() => Promise.reject(new Error('context lost'))))
    const cancel = vi.fn(() => Promise.resolve())
    installFakeBridge({ render: { start: () => Promise.resolve('render_1'), cancel } })

    bar()
    await userEvent.click(screen.getByRole('button', { name: /Rendre en vidéo/ }))

    expect(cancel).toHaveBeenCalledWith('render_1')
  })
})
