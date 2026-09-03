import { beforeEach, describe, expect, it, vi } from 'vitest'
import { installFakeBridge } from '@/services/fakeBridge'
import { useProject } from '@/stores/project'
import { takeExternalFiles } from './externalFiles'

const project = {
  path: '/projects/one',
  manifest: {
    version: 1,
    createdAt: '2026-09-03T09:00:00.000Z',
    updatedAt: '2026-09-03T10:00:00.000Z',
  },
}

describe('external file arrivals', () => {
  beforeEach(() => useProject.setState({ project, known: true }))

  it('imports into the project explicitly chosen from the existing shelf', async () => {
    const ingestPaths = vi.fn(async () => [])
    installFakeBridge({
      externalFiles: {
        take: async () => [{ id: 'request-1' }],
      },
      newDocument: {
        ask: async () => ({ answer: 'recentProject', path: project.path }),
      },
      media: { ingestPaths },
    })

    await takeExternalFiles()

    await vi.waitFor(() => expect(ingestPaths).toHaveBeenCalledWith('request-1', ''))
  })

  it('copies nothing when the project choice is cancelled', async () => {
    const ingestPaths = vi.fn(async () => [])
    const ask = vi.fn(async () => null)
    const discard = vi.fn(async () => undefined)
    installFakeBridge({
      externalFiles: {
        take: async () => [{ id: 'request-2' }],
        discard,
      },
      newDocument: { ask },
      media: { ingestPaths },
    })

    await takeExternalFiles()
    await vi.waitFor(() => expect(ask).toHaveBeenCalledOnce())
    expect(discard).toHaveBeenCalledWith('request-2')
    expect(ingestPaths).not.toHaveBeenCalled()
  })

  it('continues with the next arrival after an import fails', async () => {
    const ingestPaths = vi
      .fn()
      .mockRejectedValueOnce(new Error('copy failed'))
      .mockResolvedValueOnce([])
    installFakeBridge({
      externalFiles: {
        take: async () => [
          { id: 'request-3', folder: '' },
          { id: 'request-4', folder: '' },
        ],
      },
      media: { ingestPaths },
    })

    await takeExternalFiles()

    await vi.waitFor(() => expect(ingestPaths).toHaveBeenCalledTimes(2))
    expect(ingestPaths).toHaveBeenLastCalledWith('request-4', '')
  })
})
