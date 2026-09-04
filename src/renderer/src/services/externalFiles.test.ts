import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LogEntry } from '@shared/ipc'
import { installFakeBridge } from '@/services/fakeBridge'
import { useProject } from '@/stores/project'
import { importExternalFiles, takeExternalFiles } from './externalFiles'

vi.mock('i18next', () => ({
  default: {
    t: (_key: string, params?: { extensions: string }) =>
      params ? `Unsupported ${params.extensions}` : 'Importing files',
  },
}))

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
    const ingestPaths = vi.fn(async () => ({
      assets: [],
      documents: [],
      montages: [],
      refused: [],
      failed: [],
    }))
    installFakeBridge({
      externalFiles: {
        take: async () => [{ request: { id: 'request-1' }, refused: [] }],
      },
      newDocument: {
        ask: async () => ({ answer: 'recentProject', path: project.path }),
      },
      media: { ingestPaths },
    })

    await takeExternalFiles()

    await vi.waitFor(() =>
      expect(ingestPaths).toHaveBeenCalledWith('request-1', '', expect.any(String)),
    )
  })

  it('copies nothing when the project choice is cancelled', async () => {
    const ingestPaths = vi.fn(async () => ({
      assets: [],
      documents: [],
      montages: [],
      refused: [],
      failed: [],
    }))
    const ask = vi.fn(async () => null)
    const discard = vi.fn(async () => undefined)
    installFakeBridge({
      externalFiles: {
        take: async () => [{ request: { id: 'request-2' }, refused: [] }],
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

  it('asks for a project when a target receives a desktop file before one is open', async () => {
    useProject.setState({ project: null, known: true })
    const ask = vi.fn(async () => null)
    const discard = vi.fn(async () => undefined)
    const ingestPaths = vi.fn()
    installFakeBridge({
      externalFiles: {
        offer: async () => ({ request: { id: 'request-without-project' }, refused: [] }),
        discard,
      },
      newDocument: { ask },
      media: { ingestPaths },
    })

    await importExternalFiles([new File(['video'], 'rush.mp4')], vi.fn())

    await vi.waitFor(() => expect(ask).toHaveBeenCalledOnce())
    expect(discard).toHaveBeenCalledWith('request-without-project')
    expect(ingestPaths).not.toHaveBeenCalled()
  })

  it('releases the paths the main holds when an import fails', async () => {
    const discard = vi.fn(async () => undefined)
    installFakeBridge({
      externalFiles: {
        take: async () => [{ request: { id: 'request-5', folder: '' }, refused: [] }],
        discard,
      },
      media: { ingestPaths: vi.fn().mockRejectedValue(new Error('copy failed')) },
    })

    await takeExternalFiles()

    await vi.waitFor(() => expect(discard).toHaveBeenCalledWith('request-5'))
  })

  it('continues with the next arrival after an import fails', async () => {
    const ingestPaths = vi
      .fn()
      .mockRejectedValueOnce(new Error('copy failed'))
      .mockResolvedValueOnce({ assets: [], documents: [], montages: [], refused: [], failed: [] })
    installFakeBridge({
      externalFiles: {
        take: async () => [
          { request: { id: 'request-3', folder: '' }, refused: [] },
          { request: { id: 'request-4', folder: '' }, refused: [] },
        ],
      },
      media: { ingestPaths },
    })

    await takeExternalFiles()

    await vi.waitFor(() => expect(ingestPaths).toHaveBeenCalledTimes(2))
    expect(ingestPaths).toHaveBeenLastCalledWith('request-4', '', expect.any(String))
  })

  it('reports unsupported files from a desktop launch instead of dropping them silently', async () => {
    const report = vi.fn(async (_entry: LogEntry) => undefined)
    installFakeBridge({
      externalFiles: {
        take: async () => [
          {
            request: null,
            refused: [{ name: 'notes.txt', extension: 'txt' }],
          },
        ],
      },
      diagnostics: { report },
    })

    await takeExternalFiles()

    await vi.waitFor(() =>
      expect(report).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'warn', scope: 'assets.copy' }),
      ),
    )
    expect(report.mock.calls[0]?.[0].message).toContain('.txt')
  })
})
