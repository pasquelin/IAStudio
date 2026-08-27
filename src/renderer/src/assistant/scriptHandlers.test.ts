import { beforeEach, describe, expect, it, vi } from 'vitest'
import { installFakeBridge } from '@/services/fakeBridge'
import { useCode } from '@/stores/code'
import { useProject } from '@/stores/project'
import { runAction } from './executor'

const WALK = 'script:Walk.ts'
const WHEN = '2026-08-27T00:00:00.000Z'

describe('the scripts of a project, written from outside the window', () => {
  beforeEach(() => {
    useProject.setState({
      project: {
        path: '/tmp/p',
        manifest: { version: 1, name: 'P', createdAt: WHEN, updatedAt: WHEN },
      },
    })
    useCode.setState({ files: {}, problems: [], goto: null })
    installFakeBridge({
      game: {
        scripts: () => Promise.resolve([]),
        writeScript: () => Promise.resolve(true),
      },
    })
  })

  /**
   * 🛑 The defect this test exists for: a model writing a file an author is typing in used to
   * take the text with it — no word, no undo, `⌘Z` not reaching the code editor.
   */
  it('refuses to write over work an author has not saved', async () => {
    useCode.setState({
      files: { [WALK]: { script: WALK, saved: 'const a = 1', source: 'const a = 2' } },
    })

    const outcome = await runAction('script.write', { path: 'Walk.ts', source: 'const a = 3' })

    expect(outcome).toMatchObject({ ok: false, refusal: 'badInput' })
    expect(useCode.getState().files[WALK]?.source).toBe('const a = 2')
  })

  it('writes a script the editor is not holding', async () => {
    const outcome = await runAction('script.write', {
      path: 'Walk.ts',
      source: 'export default defineScript({ onUpdate() {} })',
    })

    expect(outcome).toMatchObject({ ok: true })
    expect(useCode.getState().files[WALK]?.source).toContain('defineScript')
  })

  /** 🛑 Refused with the LINE: what the next Play would refuse anyway, said before it lands. */
  it('refuses a script naming a module the sandbox does not hold', async () => {
    const outcome = await runAction('script.write', {
      path: 'Walk.ts',
      source: "import { readFile } from 'node:fs'\nexport default {}",
    })

    expect(outcome).toMatchObject({ ok: false, refusal: 'badInput' })
    expect(!outcome.ok && outcome.detail).toContain('node:fs')
  })

  /**
   * A file the project refused must not sit in the list as one it holds: the window's own guard
   * would retry writing it on the way out.
   */
  it('leaves no ghost behind when the project refused the path', async () => {
    installFakeBridge({
      game: { scripts: () => Promise.resolve([]), writeScript: () => Promise.resolve(false) },
    })

    await runAction('script.write', { path: 'Walk.ts', source: 'export default {}' })

    expect(useCode.getState().files[WALK]).toBeUndefined()
  })

  it('says there is no project rather than blaming the surface', async () => {
    useProject.setState({ project: null })

    expect(await runAction('script.list', {})).toMatchObject({ ok: false, refusal: 'noProject' })
  })

  it('refuses a path that is not a script at all', async () => {
    expect(await runAction('script.write', { path: 'notes.txt', source: '' })).toMatchObject({
      ok: false,
      refusal: 'badInput',
    })
  })
})

vi.mock('@/engines/code/scriptCompiler', async importActual => {
  const held = await importActual<Record<string, unknown>>()
  // jsdom has no `Worker`, and what is under test is the handler's refusals — the transpile
  // itself is settled by `transpile.test.ts`.
  const { transpile } = await import('@/engines/code/transpile')
  return {
    ...held,
    createScriptCompiler: () => ({
      compile: (sources: readonly { script: string; source: string }[]) => {
        const troubles = sources
          .map(one => ({ one, held: transpile(one.source) }))
          .filter(({ held: read }) => 'trouble' in read)
          .map(({ one, held: read }) => ({
            script: one.script,
            message: 'trouble' in read ? read.trouble : '',
            line: 'trouble' in read ? read.line : 0,
          }))
        return Promise.resolve({ modules: [], troubles })
      },
    }),
  }
})
