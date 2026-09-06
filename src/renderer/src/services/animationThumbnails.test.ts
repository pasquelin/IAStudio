import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import { generateAnimationThumbnails } from './animationThumbnails'

const state = vi.hoisted(() => ({
  send: vi.fn(),
  save: vi.fn(),
  model: vi.fn(),
  dispose: vi.fn(),
  report: vi.fn(),
  controller: new AbortController(),
}))
vi.mock('./bridge', () => ({
  getBridge: () => ({
    assets: { animationThumbnailModel: state.model, saveAnimationThumbnail: state.save },
  }),
}))
vi.mock('./diagnostics', () => ({ reportFailure: state.report }))
vi.mock('@/stores/project', () => ({
  useProject: { getState: () => ({ project: { path: '/project' } }) },
}))
vi.mock('@/stores/tasks', () => ({
  runTask: async (_label: string, work: (id: string, watch: object) => Promise<void>) =>
    work('task', { signal: state.controller.signal }),
}))
vi.mock('@/engines/core/workerSession', () => ({
  createWorkerSession: () => ({ nextId: () => 1, send: state.send, dispose: state.dispose }),
}))
const motion = (id: string): Asset => ({
  id,
  name: id + '.glb',
  path: 'Animations/' + id + '.glb',
  type: 'animation',
  location: 'local',
  tags: [],
  createdAt: '',
})
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('document', { baseURI: 'file:///app/renderer/index.html' })
  state.controller = new AbortController()
  state.model.mockResolvedValue(new Uint8Array([1]))
  state.send.mockResolvedValue({ ok: true, png: new Uint8Array([2]) })
  state.save.mockResolvedValue(undefined)
})
afterEach(() => vi.unstubAllGlobals())
it('reuses one character for a batch and saves each missing poster next to its animation', async () => {
  await generateAnimationThumbnails([
    motion('Walk'),
    { ...motion('Ready'), posterPath: 'ready.png' },
    motion('Jump'),
  ])
  expect(state.model).toHaveBeenCalledOnce()
  expect(state.send).toHaveBeenCalledTimes(2)
  expect(state.send.mock.calls[0]?.[0].decoderRoot).toBe('file:///app/renderer/decoders/')
  expect(state.send.mock.calls[0]?.[0].model).toBeInstanceOf(ArrayBuffer)
  expect(state.send.mock.calls[1]?.[0].model).toBeUndefined()
  expect(state.save).toHaveBeenCalledWith(
    expect.objectContaining({
      assetId: 'Jump',
      sourcePath: 'Animations/Jump.glb',
      projectPath: '/project',
    }),
  )
  expect(state.dispose).toHaveBeenCalledOnce()
})
it('keeps processing after an unreadable clip and releases the worker', async () => {
  state.send.mockResolvedValueOnce({ ok: false, error: 'invalid clip' })
  await generateAnimationThumbnails([motion('Broken'), motion('Jump')])
  expect(state.report).toHaveBeenCalledOnce()
  expect(state.save).toHaveBeenCalledOnce()
  expect(state.dispose).toHaveBeenCalledOnce()
})

it('does not save a render that finishes after cancellation', async () => {
  state.send.mockImplementationOnce(async () => {
    state.controller.abort()
    return { ok: true, png: new Uint8Array([2]) }
  })
  await generateAnimationThumbnails([motion('Jump')])
  expect(state.save).not.toHaveBeenCalled()
  expect(state.report).not.toHaveBeenCalled()
  expect(state.dispose).toHaveBeenCalled()
})
