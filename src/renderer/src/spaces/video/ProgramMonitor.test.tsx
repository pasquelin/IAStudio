import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addClip } from '@/engines/timeline/commands'
import type { Clip } from '@/engines/timeline/timeline-state'
import { useSequences } from '@/stores/sequences'
import { ProgramMonitor } from './ProgramMonitor'

const mount = vi.fn(() => Promise.resolve())
const apply = vi.fn()
const dispose = vi.fn()

// jsdom has neither WebGL nor WebCodecs: the engine is exercised by hand, not here. What this
// covers is that the monitor builds one engine per document and hands the state to it.
vi.mock('@/engines/timeline/TimelineEngine', () => ({
  TimelineEngine: class {
    mount = mount
    apply = apply
    seek = vi.fn(() => Promise.resolve())
    play = vi.fn()
    pause = vi.fn()
    playing = vi.fn(() => false)
    openDecoders = vi.fn(() => 0)
    dispose = dispose
  },
}))

const clip: Clip = {
  id: 'clip-1',
  assetId: 'asset-1',
  start: 0,
  duration: 1_000_000,
  inPoint: 0,
  speed: 1,
}

describe('ProgramMonitor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSequences.setState({ states: {}, histories: {} })
  })

  it('mounts an engine into its host', () => {
    render(<ProgramMonitor documentId="doc-1" />)
    expect(mount).toHaveBeenCalledTimes(1)
  })

  it('hands the engine to whoever owns the transport', () => {
    const onEngine = vi.fn()
    render(<ProgramMonitor documentId="doc-1" onEngine={onEngine} />)
    expect(onEngine).toHaveBeenCalledWith(expect.objectContaining({ play: expect.anything() }))
  })

  it('pushes every state change into the engine', () => {
    render(<ProgramMonitor documentId="doc-1" />)
    apply.mockClear()

    act(() => useSequences.getState().runCommand('doc-1', addClip('V1', clip)))

    expect(apply).toHaveBeenCalledTimes(1)
  })

  it('ignores an edit made on another document', () => {
    render(<ProgramMonitor documentId="doc-1" />)
    apply.mockClear()

    act(() => useSequences.getState().runCommand('doc-2', addClip('V1', clip)))

    expect(apply).not.toHaveBeenCalled()
  })

  it('disposes the engine on unmount, since a WebGL context outliving it is a leak', () => {
    const onEngine = vi.fn()
    const view = render(<ProgramMonitor documentId="doc-1" onEngine={onEngine} />)

    view.unmount()

    expect(dispose).toHaveBeenCalledTimes(1)
    expect(onEngine).toHaveBeenLastCalledWith(null)
  })
})
