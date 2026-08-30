import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useMountedEngine } from './useMountedEngine'

class FakeEngine {
  mounted: HTMLElement | null = null
  applied: string[] = []
  disposed = 0

  constructor(readonly builtFor: string) {}

  mount(host: HTMLElement): void {
    this.mounted = host
  }
  apply(state: string): void {
    this.applied.push(state)
  }
  dispose(): void {
    this.disposed += 1
  }
}

function Host({
  documentId,
  state,
  built,
}: {
  documentId: string
  state: string
  built: (engine: FakeEngine) => void
}) {
  // Closing over `documentId` as every caller does: it is what the engine is wired to.
  const { host } = useMountedEngine(
    documentId,
    () => {
      const engine = new FakeEngine(documentId)
      built(engine)
      return engine
    },
    state,
  )

  return <div ref={host} />
}

function rendering(state = 'first') {
  const engines: FakeEngine[] = []
  const built = (engine: FakeEngine) => engines.push(engine)
  const view = render(<Host documentId="a" state={state} built={built} />)
  return { engines, built, view }
}

describe('useMountedEngine', () => {
  it('builds one engine into the host element and hands it the state', () => {
    const { engines } = rendering()

    expect(engines).toHaveLength(1)
    expect(engines[0]?.mounted).toBeInstanceOf(HTMLDivElement)
    expect(engines[0]?.applied).toEqual(['first'])
  })

  /**
   * Every caller writes the factory inline, so reading it as a dependency would tear the viewport
   * down and build it again on each render of the document — sixty times a second under a drag.
   */
  it('pushes a later state into the engine already mounted rather than rebuilding it', () => {
    const { engines, built, view } = rendering()

    view.rerender(<Host documentId="a" state="second" built={built} />)

    expect(engines).toHaveLength(1)
    expect(engines[0]?.applied).toEqual(['first', 'second'])
  })

  /** A WebGL context does not survive a detach: the engine goes with the tab that held it. */
  it('disposes the engine when its host goes', () => {
    const { engines, view } = rendering()

    view.unmount()

    expect(engines[0]?.disposed).toBe(1)
  })

  /**
   * `builtFor` rather than the count alone: a factory read from a STALE render would still build,
   * mount and apply — every other assertion here would pass on an engine wired to the tab before.
   */
  it('rebuilds for another document from that document, disposing the one before', () => {
    const { engines, built, view } = rendering()

    view.rerender(<Host documentId="b" state="first" built={built} />)

    expect(engines.map(engine => engine.builtFor)).toEqual(['a', 'b'])
    expect(engines[0]?.disposed).toBe(1)
    expect(engines[1]?.disposed).toBe(0)
  })
})
