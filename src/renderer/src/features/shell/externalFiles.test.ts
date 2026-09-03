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
        take: async () => [{ paths: ['/outside/model.glb'] }],
      },
      newDocument: {
        ask: async () => ({ answer: 'recentProject', path: project.path }),
      },
      media: { ingestPaths },
    })

    await takeExternalFiles()

    await vi.waitFor(() => expect(ingestPaths).toHaveBeenCalledWith(['/outside/model.glb'], ''))
  })

  it('copies nothing when the project choice is cancelled', async () => {
    const ingestPaths = vi.fn(async () => [])
    const ask = vi.fn(async () => null)
    installFakeBridge({
      externalFiles: {
        take: async () => [{ paths: ['/outside/model.glb'] }],
      },
      newDocument: { ask },
      media: { ingestPaths },
    })

    await takeExternalFiles()
    await vi.waitFor(() => expect(ask).toHaveBeenCalledOnce())
    expect(ingestPaths).not.toHaveBeenCalled()
  })
})
