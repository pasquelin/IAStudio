import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Job, JobStatus } from '@shared/domain/job'
import { installFakeBridge } from '@/services/fakeBridge'
import { scriptRefOf, useCode } from './code'
import { claimScriptOnSubmit, connectCodeGeneration } from './codeGeneration'
import { installDocument } from './document-fixtures'
import { useDocuments } from './documents'
import { flush } from './generation-fixtures'
import { job as jobOf } from './job-fixtures'
import { useJobs } from './jobs'

const written: { path: string; source: string }[] = []
const reported: { scope: string; message: string }[] = []

const SCRIPT = 'export const answer = 1'

/** The reference the fixture's own document spells — a script is keyed by its PATH, never its id. */
const openScript = (): string => {
  const script = scriptRefOf('doc-1')
  if (script === null) throw new Error('the fixture opened no script')
  return script
}

const job = (overrides: Partial<Job> = {}): Job =>
  jobOf({ id: 'job_1', label: 'Claude', ...overrides })

/** Settles the job. The landing that follows reaches its editor through an `import()`. */
function finish(status: JobStatus, overrides: Partial<Job> = {}): void {
  useJobs.setState({ jobs: [job({ status, ...overrides })] })
}

/** Waits for the landing to have run — a condition, so a case never turns on a count of ticks. */
async function until(landed: () => boolean): Promise<void> {
  for (let at = 0; at < 50 && !landed(); at += 1) await flush()
}

/** For the cases that assert NOTHING landed: the same room, spent without a condition to meet. */
const quiet = async (): Promise<void> => {
  for (let at = 0; at < 50; at += 1) await flush()
}

let stop = (): void => undefined

/**
 * The landing reaches its editor through an `import()`, and that module pulls the whole document
 * creation with it. Loaded once here so a case waits on the SEAM rather than on a bundler.
 */
beforeAll(async () => {
  await import('@/features/code/landScript')
})

beforeEach(() => {
  written.length = 0
  reported.length = 0
  installFakeBridge({
    diagnostics: {
      report: (line: { scope: string; message: string }) => {
        reported.push(line)
        return Promise.resolve()
      },
    },
    game: {
      writeScript: (path: string, source: string) => {
        written.push({ path, source })
        return Promise.resolve(true)
      },
    },
  })
  // `stored` as well as the tabs: `landScript` asks `documentAtPath` whether the path it is
  // about to write is one somebody already has work in, and that reads the stored list.
  useDocuments.setState({ documents: {}, activeId: null, stored: [] })
  useJobs.setState({ jobs: [] })
  useCode.setState({ files: {}, problems: [], goto: null })
  stop = connectCodeGeneration()
})

afterEach(() => {
  stop()
  vi.restoreAllMocks()
})

describe('where a generated script lands', () => {
  it('writes into the editor it was launched from', async () => {
    installDocument('doc-1', 'code')
    useCode.getState().installed(openScript(), 'export const answer = 0')
    claimScriptOnSubmit()(job())

    finish('succeeded', { text: SCRIPT })
    await until(() => useCode.getState().files[openScript()]?.source === SCRIPT)

    expect(useCode.getState().files[openScript()]?.source).toBe(SCRIPT)
  })

  /** Asked for a tab of its own: the file is written first, since its path IS its identity. */
  it('writes a file of its own when asked for a new tab', async () => {
    installDocument('doc-1', 'code')
    claimScriptOnSubmit('newTab')(job())

    finish('succeeded', { text: SCRIPT })
    await until(() => written.length > 0)

    expect(written).toHaveLength(1)
    expect(written[0]?.source).toBe(SCRIPT)
  })

  /**
   * 🛑 Said rather than dropped: the generation was PAID for, and `⌘Z` does not reach into the
   * code editor either — so a refusal nobody is told about is a refusal nobody can act on.
   */
  it('says so when the editor holds unsaved work', async () => {
    installDocument('doc-1', 'code')
    useCode.getState().installed(openScript(), 'export const answer = 0')
    useCode.getState().edited(openScript(), 'export const answer = 2')
    claimScriptOnSubmit()(job())

    finish('succeeded', { text: SCRIPT })
    await until(() => reported.length > 0)

    expect(reported[0]?.scope).toBe('code.land')
  })

  /** 🛑 `⌘Z` does not reach into the code editor, so unsaved work is never overwritten. */
  it('leaves unsaved work in the editor alone', async () => {
    installDocument('doc-1', 'code')
    useCode.getState().installed(openScript(), 'export const answer = 0')
    useCode.getState().edited(openScript(), 'export const answer = 2')
    claimScriptOnSubmit()(job())

    finish('succeeded', { text: SCRIPT })
    await quiet()

    expect(useCode.getState().files[openScript()]?.source).toBe('export const answer = 2')
  })

  it('lands nothing from a job that failed', async () => {
    installDocument('doc-1', 'code')
    useCode.getState().installed(openScript(), 'export const answer = 0')
    claimScriptOnSubmit()(job())

    finish('failed', { text: SCRIPT })
    await quiet()

    expect(useCode.getState().files[openScript()]?.source).toBe('export const answer = 0')
  })

  /**
   * 🛑 The claims are fanned out to every space at once, so this seam sees the picture
   * generations too — and a job with no text of its own must land nothing at all.
   */
  it('lands nothing from a generation that produced an asset', async () => {
    installDocument('doc-1', 'code')
    claimScriptOnSubmit('newTab')(job())

    finish('succeeded', { assetIds: ['asset-1'] })
    await quiet()

    expect(written).toEqual([])
  })
})
