import { beforeEach, describe, expect, it, vi } from 'vitest'
import { installFakeBridge } from '@/services/fakeBridge'
import { forgetReportedFailures } from '@/services/diagnostics'
import { installDocument, retitleDocument } from '@/stores/document-fixtures'
import { useTasks } from '@/stores/tasks'
import { runDocumentExport, type DocumentExport } from './documentExport'

const SKY: DocumentExport = { kind: 'skybox', scope: 'skybox.export', label: '2048' }

describe('runDocumentExport', () => {
  beforeEach(() => {
    forgetReportedFailures()
    installDocument('doc', 'skyboxes')
  })

  it('names the task after the tab and hands the writer the bridge', async () => {
    const bridge = installFakeBridge()
    retitleDocument('doc', 'Sunset')
    const seen: { labels: string[]; handed: unknown } = { labels: [], handed: null }

    await runDocumentExport('doc', SKY, given => {
      seen.labels = Object.values(useTasks.getState().running).map(task => task.label)
      seen.handed = given
      return Promise.resolve()
    })

    expect(seen.labels).toEqual(['Sunset'])
    expect(seen.handed).toBe(bridge)
  })

  /**
   * `kind` is the FALLBACK, so nothing observes it while a tab has a title — and swapping it with
   * `label` would then rename every file after whatever the failure names.
   */
  it('falls back on the kind for a tab with no title of its own', async () => {
    installFakeBridge()
    retitleDocument('doc', '')
    let named: string[] = []

    await runDocumentExport('doc', SKY, () => {
      named = Object.values(useTasks.getState().running).map(task => task.label)
      return Promise.resolve()
    })

    expect(named).toEqual(['skybox'])
  })

  /** A gesture that refused is said once, and never thrown back at a menu click nobody awaits. */
  it('reports a writer that threw instead of rejecting', async () => {
    const said = vi.fn().mockResolvedValue(undefined)
    installFakeBridge({ diagnostics: { report: said } })

    await expect(
      runDocumentExport('doc', SKY, () => Promise.reject(new Error('no picture'))),
    ).resolves.toBeUndefined()

    expect(said.mock.calls[0]?.[0]).toMatchObject({ scope: 'skybox.export' })
    expect(String(said.mock.calls[0]?.[0]?.message)).toContain('2048')
  })
})
