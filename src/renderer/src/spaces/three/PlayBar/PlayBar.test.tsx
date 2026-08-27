import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { newComponent } from '@shared/domain/componentRegistry'
import { createInertPhysics } from '@game/host/inertPhysics'
import { createDefaultScene } from '@/engines/scene/defaultScene'
import { meshNode } from '@/engines/scene/scene-fixtures'
import { installScene } from '@/stores/scene-fixtures'
import { forgetSceneEngine, registerSceneEngine } from '@/stores/sceneEngines'
import { drawing } from '@/game/game-fixtures'
import { usePlay } from '@/stores/play'
import { PlayBar } from './PlayBar'

/** 2,7 Mo of WebAssembly for a bar that draws four buttons — see `play.test.ts`. */
vi.mock('@game/host/rapierPhysics', () => ({
  loadRapierPhysics: () => Promise.resolve(createInertPhysics()),
}))

const DOCUMENT = 'doc-scene'

function show() {
  installScene(DOCUMENT, {
    ...createDefaultScene(),
    nodes: [{ ...meshNode('a'), components: [newComponent('Movement')] }],
    selectedIds: [],
  })
  registerSceneEngine(DOCUMENT, drawing())
  const host = document.createElement('div')
  render(<PlayBar documentId={DOCUMENT} viewport={() => host} />)
}

afterEach(() => {
  usePlay.getState().stop(DOCUMENT)
  forgetSceneEngine(DOCUMENT)
})

describe('the transport of a scene played as a game', () => {
  it('offers only Play while nothing runs, and says nothing about a game there is none of', () => {
    show()

    expect(screen.getByRole('button', { name: 'Jouer' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Arrêter' })).toBeDisabled()
    expect(screen.queryByText(/objet/)).not.toBeInTheDocument()
  })

  it('says what the game holds once it runs, and offers to pause it', async () => {
    show()

    await userEvent.click(screen.getByRole('button', { name: 'Jouer' }))

    // Awaited: the engine lands a microtask later, so the transport draws Play once more first.
    expect(await screen.findByRole('button', { name: 'Pause' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Arrêter' })).toBeEnabled()
    expect(screen.getByText(/1 objet ·/)).toBeInTheDocument()
  })

  it('offers Play again once paused, and takes the game back to edit on stop', async () => {
    show()

    await userEvent.click(screen.getByRole('button', { name: 'Jouer' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Pause' }))
    expect(screen.getByRole('button', { name: 'Jouer' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Arrêter' }))
    expect(screen.getByRole('button', { name: 'Arrêter' })).toBeDisabled()
    expect(screen.queryByText(/objet/)).not.toBeInTheDocument()
  })
})

/**
 * A system that throws is reported and the tick carries on — so without a word here the game
 * would simply appear to do nothing.
 */
describe('a game whose systems are failing', () => {
  it('says how many faults there are, and names the last', () => {
    usePlay.setState({
      reports: {
        [DOCUMENT]: {
          state: 'playing',
          tick: 12,
          fps: 60,
          frameMs: 16,
          entities: 1,
          errors: [],
          logs: [
            { level: 'info', message: 'started', at: 0 },
            { level: 'error', message: 'system script threw: broken', at: 1 },
          ],
        },
      },
    })
    render(<PlayBar documentId={DOCUMENT} viewport={() => null} />)

    expect(screen.getByText('1 erreur')).toBeInTheDocument()
    expect(screen.getByTitle('system script threw: broken')).toBeInTheDocument()
  })

  /** 🛑 Two things wrong is two things: counting one family hid the other entirely. */
  it('counts the addressable faults and the engine errors together', () => {
    usePlay.setState({
      reports: {
        [DOCUMENT]: {
          state: 'playing',
          tick: 12,
          fps: 60,
          frameMs: 16,
          entities: 1,
          errors: [
            {
              script: 'script:Walk.ts',
              entity: null,
              message: 'cannot import node:fs',
              line: 3,
              column: 0,
              at: 1,
            },
          ],
          logs: [{ level: 'error', message: 'system script threw: broken', at: 2 }],
        },
      },
    })
    render(<PlayBar documentId={DOCUMENT} viewport={() => null} />)

    expect(screen.getByText('2 erreurs')).toBeInTheDocument()
  })
})
