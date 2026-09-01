import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LogEntry, RuntimeError } from '@shared/domain/gameRuntime'
import { newComponent } from '@shared/domain/componentRegistry'
import { documentFolderOf } from '@shared/domain/document'
import { createInertPhysics } from '@game/host/inertPhysics'
import { createDefaultScene } from '@/engines/scene/defaultScene'
import { meshNode } from '@/engines/scene/scene-fixtures'
import { installScene } from '@/stores/scene-fixtures'
import { forgetSceneEngine, registerSceneEngine } from '@/stores/sceneEngines'
import { drawing } from '@/game/game-fixtures'
import { useCode } from '@/stores/code'
import { installDocument } from '@/stores/document-fixtures'
import { usePlay } from '@/stores/play'
import { SceneSnapPlay } from './SceneSnapPlay'

const WALK = `script:${documentFolderOf('script')}/Walk.ts`

/** 2,7 Mo of WebAssembly for a bar that draws two buttons — see `play.test.ts`. */
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
  render(<SceneSnapPlay documentId={DOCUMENT} viewport={() => host} />)
}

const play = () => screen.getByRole('button', { name: 'Jouer' })
const stop = () => screen.getByRole('button', { name: 'Arrêter' })

afterEach(() => {
  usePlay.getState().stop(DOCUMENT)
  forgetSceneEngine(DOCUMENT)
})

describe('the transport of a scene played as a game', () => {
  it('offers only Play while nothing runs, and says nothing about a game there is none of', () => {
    show()

    expect(play()).toBeEnabled()
    expect(stop()).toBeDisabled()
    expect(screen.queryByText(/objet/)).not.toBeInTheDocument()
  })

  /**
   * 🛑 The whole reading of this transport: the coloured button is the one to press. Painted by
   * `StatusTone` rather than at the call site — the same green says « this went well » elsewhere.
   */
  it('paints Play green while it can be pressed, and Stop red only once there is a game', async () => {
    show()

    expect(play()).toHaveClass('text-success')
    expect(stop()).not.toHaveClass('text-danger')

    await userEvent.click(play())

    // Waited on the STATE, not on the button: both are drawn from the first render, so a
    // `findByRole` answers instantly with the transport as it was before the engine landed.
    await waitFor(() => expect(play()).toBeDisabled())
    expect(stop()).toHaveClass('text-danger')
    expect(play()).not.toHaveClass('text-success')
  })

  it('grays Play out while the game runs, and takes the game back to edit on stop', async () => {
    show()

    await userEvent.click(play())

    // The engine lands a beat later: until it does, the transport is still the one at rest.
    await waitFor(() => expect(play()).toBeDisabled())
    expect(stop()).toBeEnabled()

    await userEvent.click(stop())

    expect(stop()).toBeDisabled()
    expect(play()).toBeEnabled()
  })
})

/**
 * A system that throws is reported and the tick carries on — so without a sign here the game
 * would simply appear to do nothing.
 */
describe('a game whose systems are failing', () => {
  const playing = (errors: readonly RuntimeError[], logs: readonly LogEntry[]) =>
    usePlay.setState({
      reports: {
        [DOCUMENT]: {
          state: 'playing',
          tick: 12,
          fps: 60,
          frameMs: 16,
          entities: 1,
          veil: 0,
          errors,
          logs,
        },
      },
    })

  it('says how many faults there are, and names the last', () => {
    playing(
      [],
      [
        { level: 'info', message: 'started', at: 0 },
        { level: 'error', message: 'system script threw: broken', at: 1 },
      ],
    )
    render(<SceneSnapPlay documentId={DOCUMENT} viewport={() => null} />)

    expect(screen.getByRole('button', { name: '1 erreur' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '1 erreur' })).toHaveAttribute(
      'data-tooltip-content',
      'system script threw: broken',
    )
  })

  /** 🛑 Two things wrong is two things: counting one family hid the other entirely. */
  it('counts the addressable faults and the engine errors together', () => {
    playing(
      [{ script: WALK, entity: null, message: 'cannot import node:fs', line: 3, column: 0, at: 1 }],
      [{ level: 'error', message: 'system script threw: broken', at: 2 }],
    )
    render(<SceneSnapPlay documentId={DOCUMENT} viewport={() => null} />)

    expect(screen.getByRole('button', { name: '2 erreurs' })).toBeInTheDocument()
  })

  /** 🛑 The whole point of an ADDRESSABLE fault: one click and the cursor is on the line. */
  it('opens the editor on the line of the last fault a reader can open', async () => {
    playing([{ script: WALK, entity: null, message: 'no', line: 7, column: 3, at: 1 }], [])
    // The script has to BE a document of the project: a fault naming one the project does not
    // hold opens nothing at all, which `openScript.test.ts` states from the other side.
    installDocument('Walk', 'code')
    render(<SceneSnapPlay documentId={DOCUMENT} viewport={() => null} />)

    await userEvent.click(screen.getByRole('button', { name: '1 erreur' }))

    expect(useCode.getState().goto).toEqual({ script: WALK, line: 7, column: 3 })
  })
})
