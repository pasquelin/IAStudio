import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { newComponent } from '@shared/domain/componentRegistry'
import { createDefaultScene } from '@/engines/scene/defaultScene'
import { meshNode } from '@/engines/scene/scene-fixtures'
import { installScene } from '@/stores/scene-fixtures'
import { forgetSceneEngine, registerSceneEngine } from '@/stores/sceneEngines'
import type { SceneRenderer } from '@/engines/scene/SceneRenderer'
import { usePlay } from '@/stores/play'
import { PlayBar } from './PlayBar'

const DOCUMENT = 'doc-scene'

const drawing = (): SceneRenderer => {
  const engine = { apply: () => {} }
  // The registry holds a whole `SceneRenderer`, and a running game asks it for one method — see
  // `SceneDraw`. Standing in for the rest would mean a WebGL context this suite has not got.
  return engine as unknown as SceneRenderer
}

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
    expect(screen.queryByText(/objets/)).not.toBeInTheDocument()
  })

  it('says what the game holds once it runs, and offers to pause it', async () => {
    show()

    await userEvent.click(screen.getByRole('button', { name: 'Jouer' }))

    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Arrêter' })).toBeEnabled()
    expect(screen.getByText(/1 objets/)).toBeInTheDocument()
  })

  it('offers Play again once paused, and takes the game back to edit on stop', async () => {
    show()

    await userEvent.click(screen.getByRole('button', { name: 'Jouer' }))
    await userEvent.click(screen.getByRole('button', { name: 'Pause' }))
    expect(screen.getByRole('button', { name: 'Jouer' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Arrêter' }))
    expect(screen.getByRole('button', { name: 'Arrêter' })).toBeDisabled()
    expect(screen.queryByText(/objets/)).not.toBeInTheDocument()
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
})
