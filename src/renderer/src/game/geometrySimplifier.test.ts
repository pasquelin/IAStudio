import { afterEach, describe, expect, it, vi } from 'vitest'
import { BoxGeometry } from 'three'
import type {
  GeometrySimplifierRequest,
  GeometrySimplifierResponse,
} from './geometrySimplifierProtocol'
import { createGeometrySimplifier } from './geometrySimplifier'

class WorkerDouble {
  static latest: WorkerDouble | null = null
  readonly posted: GeometrySimplifierRequest[] = []
  terminated = false
  private onMessage: ((event: MessageEvent<GeometrySimplifierResponse>) => void) | null = null

  constructor() {
    WorkerDouble.latest = this
  }

  addEventListener(
    kind: string,
    listener: (event: MessageEvent<GeometrySimplifierResponse>) => void,
  ): void {
    if (kind === 'message') this.onMessage = listener
  }

  postMessage(request: GeometrySimplifierRequest): void {
    this.posted.push(request)
    this.onMessage?.(
      new MessageEvent('message', {
        data: { id: request.id, kind: 'simplified', geometry: request.geometry },
      }),
    )
  }

  terminate(): void {
    this.terminated = true
  }
}

describe('geometry simplification work', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('crosses a worker boundary in a browser and releases the worker with the scene', async () => {
    vi.stubGlobal('Worker', WorkerDouble)
    const simplifier = await createGeometrySimplifier()
    const geometry = new BoxGeometry()

    const result = await simplifier.simplify(geometry, 0.5)
    simplifier.dispose()

    expect(result.getAttribute('position').count).toBe(geometry.getAttribute('position').count)
    expect(WorkerDouble.latest?.posted[0]?.ratio).toBe(0.5)
    expect(WorkerDouble.latest?.terminated).toBe(true)
  })
})
