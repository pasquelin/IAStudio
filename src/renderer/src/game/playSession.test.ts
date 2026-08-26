import { describe, expect, it, vi } from 'vitest'
import { newComponent } from '@shared/domain/componentRegistry'
import type { RuntimeReport } from '@shared/domain/gameRuntime'
import { meshNode } from '@/engines/scene/scene-fixtures'
import { EMPTY_SCENE, type SceneState } from '@/engines/scene/sceneState'
import { startPlay, type FrameDriver } from './playSession'

const scene = (): SceneState => ({
  ...EMPTY_SCENE,
  nodes: [{ ...meshNode('a'), components: [newComponent('Movement')] }, meshNode('b')],
})

/** The frames a test drives by hand, in place of the browser's. */
function handDriven() {
  let frame: ((nowMs: number) => void) | null = null
  let stopped = false

  const driver: FrameDriver = {
    start: given => {
      frame = given
    },
    stop: () => {
      stopped = true
    },
  }

  return {
    driver,
    stopped: () => stopped,
    advance: (seconds: number) => frame?.(seconds * 1000),
  }
}

function playing(state: SceneState = scene()) {
  const frames = handDriven()
  const apply = vi.fn()
  const reports: RuntimeReport[] = []

  const session = startPlay({
    documentId: 'doc-1',
    renderer: { apply },
    editState: () => state,
    input: new EventTarget(),
    frames: frames.driver,
    onReport: report => reports.push(report),
  })

  return { session, frames, apply, reports, state }
}

const lastDrawn = (apply: ReturnType<typeof vi.fn>): SceneState | null =>
  apply.mock.calls.at(-1)?.[0] ?? null

describe('a game running inside the studio', () => {
  it('says it is playing, and how much of the scene it holds, before a frame has run', () => {
    const { reports } = playing()

    expect(reports.at(-1)).toMatchObject({ state: 'playing', tick: 0, entities: 2 })
  })

  it('moves an object its component says moves, and leaves the others alone', () => {
    const { frames, apply, state } = playing()

    frames.advance(0)
    frames.advance(1)

    const drawn = lastDrawn(apply)
    expect(drawn?.nodes[0]?.transform.position.y).toBeGreaterThan(0)
    expect(drawn?.nodes[1]).toBe(state.nodes[1])
  })

  /**
   * 🛑 The criterion of the whole lot. The world holds no reference to the store, so this is not
   * a restore — there is nothing to restore, and that is what the comparison BY VALUE says.
   */
  it('leaves the edit state identical, by value, once it has been stopped', () => {
    const before = JSON.stringify(scene())
    const { session, frames, apply, state } = playing()

    frames.advance(0)
    frames.advance(2)
    session.stop()

    expect(JSON.stringify(state)).toBe(before)
    expect(lastDrawn(apply)).toBe(state)
    expect(session.state()).toBe('edit')
  })

  it('lets go of the frames when it stops', () => {
    const { session, frames } = playing()
    session.stop()

    expect(frames.stopped()).toBe(true)
  })

  it('runs no step while it is paused, and picks up where it left off', () => {
    const { session, frames, reports } = playing()

    frames.advance(0)
    frames.advance(1)
    const played = reports.at(-1)?.tick ?? 0

    session.pause()
    frames.advance(2)
    expect(reports.at(-1)?.state).toBe('paused')
    expect(reports.at(-1)?.tick).toBe(played)

    session.resume()
    // The first frame back is an origin — see the case below — so the second is what plays. The
    // report is thrown six times a second rather than sixty, hence the gap between the two.
    frames.advance(3)
    frames.advance(3.3)
    expect(reports.at(-1)?.tick).toBeGreaterThan(played)
  })

  /**
   * A game paused for a minute must not catch that minute up. Without the loop's own reset the
   * clamp still owes it a quarter of a second — fifteen steps nobody played — so the figure here
   * is exact rather than a bound.
   */
  it('does not simulate the time it spent paused', () => {
    const { session, frames, reports } = playing()

    frames.advance(0)
    frames.advance(0.2)
    const played = reports.at(-1)?.tick ?? 0

    session.pause()
    frames.advance(60)
    session.resume()
    frames.advance(60)
    frames.advance(60.2)

    expect(reports.at(-1)?.tick).toBe(played + 12)
  })
})
