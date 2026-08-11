import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { isFinished, JOB_STATUSES, type Job } from '@shared/domain/job'
import { job } from './job-fixtures'

const FINISHED = JOB_STATUSES.filter(isFinished)
const PENDING = JOB_STATUSES.filter(status => !isFinished(status))
const OUTCOMES = FINISHED.filter(status => status !== 'succeeded')

describe('job fixture', () => {
  it.each(FINISHED)('dates a %s job, as settling one does', status => {
    expect(job({ status }).finishedAt).toBe('2026-08-10T10:00:00.000Z')
  })

  it.each(PENDING)('leaves a %s job undated', status => {
    expect(job({ status }).finishedAt).toBeUndefined()
  })

  it('carries a succeeded job to full progress', () => {
    expect(job({ status: 'succeeded' }).progress).toBe(1)
  })

  /**
   * The default was held by nothing: turned into `queued`, the whole suite stayed green — found by
   * mutation. Every other test here names its status, so this is the only one that reads what a
   * caller gets by naming none, and eight suites now build on it.
   */
  it('is a job still going when no status is named', () => {
    expect(job()).toMatchObject({ status: 'running', progress: 0 })
    // Not in `toMatchObject` above: it reads an absent key and a key set to `undefined` as two
    // different things, and the factory leaves this one absent.
    expect(job().finishedAt).toBeUndefined()
  })

  it.each(OUTCOMES)('leaves a %s job at the progress it reached', status => {
    expect(job({ status, progress: 0.4 }).progress).toBe(0.4)
  })

  it('lets an explicit date win, so a suite can state the shape it needs', () => {
    const stated = job({ status: 'succeeded', finishedAt: '2026-08-11T00:00:00.000Z' })

    expect(stated.finishedAt).toBe('2026-08-11T00:00:00.000Z')
  })

  /** What `apply` leaves behind: a progress event settles a job without ever dating it. */
  it('drops the date when a suite names the key to say it has none', () => {
    expect(job({ status: 'succeeded', finishedAt: undefined }).finishedAt).toBeUndefined()
  })

  it('lets an explicit progress win on a succeeded job', () => {
    expect(job({ status: 'succeeded', progress: 0.9 }).progress).toBe(0.9)
  })

  it('applies the overrides it is given', () => {
    expect(job({ id: 'job_2', label: 'Veo' })).toMatchObject({ id: 'job_2', label: 'Veo' })
  })

  /**
   * A `failed` job the manager published always names its code: `settle` is reached from four
   * places and each passes one. A fixture that omitted it would offer a shape production never
   * holds — and a suite asserting `error === undefined` on it would be green against nothing.
   */
  it('names a failure code on a job that failed', () => {
    expect(job({ status: 'failed' }).error).toBe('rejected')
  })

  it('keeps the code a caller names, rather than its own', () => {
    expect(job({ status: 'failed', error: 'storage' }).error).toBe('storage')
  })

  it('leaves a job that did not fail without a code', () => {
    expect(job({ status: 'succeeded' }).error).toBeUndefined()
  })
})

/**
 * Every suite of the renderer, as text. Read through Vite rather than `fs`, as
 * `no-hardcoded-text.test.ts` does and for its reason: the renderer has no filesystem, and a
 * test living here does not get one.
 *
 * One short of what the disk holds, always: `import.meta.glob` never yields the module that
 * calls it. This file is therefore the one suite the walk does not read — measured, 361 against
 * 362 on 2026-08-11 — and it builds no job of its own.
 */
const SUITES: Record<string, string> = import.meta.glob(['../**/*.test.ts', '../**/*.test.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
})

/**
 * What says "this object is a `Job`", and nothing else in the studio.
 *
 * Four keys rather than the whole shape: a suite is allowed to say LESS than the type — `label`
 * or `assetIds` left out — but no other object of the renderer carries `targetId` beside
 * `progress`. The submission targets that read `{ kind, id }` have neither.
 *
 * Typed `keyof Job` rather than `string[]`, as `plan.ts` types its own field list: renaming one
 * of these in `Job` stops this file compiling instead of leaving the walk watching nothing.
 */
const JOB_KEYS: readonly (keyof Job)[] = ['kind', 'targetId', 'status', 'progress']

/** Named as `no-hardcoded-text.test.ts` names it, so a grep finds both copies. */
const scriptKindOf = (file: string): ts.ScriptKind =>
  file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS

/**
 * The object literals of one file that carry all four keys at once, minus those handed straight
 * to the factory.
 *
 * The exemption is what keeps the name honest: `job({ kind, targetId, status, progress })` USES
 * the factory, and refusing it would read as "this object is forbidden" where the rule is "build
 * it yourself and you are on your own". It is limited to the factory's own two names — see
 * `isFactoryArgument`, and the test that hands the same literal to another function.
 */
function jobLiteralsIn(file: string, code: string): number {
  const source = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, scriptKindOf(file))
  let found = 0

  const visit = (node: ts.Node): void => {
    if (ts.isObjectLiteralExpression(node) && !isFactoryArgument(node)) {
      const named = new Set(
        node.properties
          .map(property => property.name)
          .filter(name => name !== undefined)
          .filter(ts.isIdentifier)
          .map(name => name.text),
      )
      if (JOB_KEYS.every(key => named.has(key))) found += 1
    }
    ts.forEachChild(node, visit)
  }

  visit(source)
  return found
}

/**
 * The two names the factory is called by: `job` where nothing collides, `jobOf` where a suite
 * keeps a local wrapper of its own — the form `stores/image-generation.test.ts` settled on.
 */
const FACTORY_NAMES = new Set(['job', 'jobOf'])

/**
 * Handed straight TO THE FACTORY — the one call whose argument may name every key.
 *
 * Narrow on purpose: exempting any call at all would let `applyProgress({ …a whole job… })`
 * through, and that is the seventh suite this guard exists to stop. An object literal whose
 * parent is a call is always one of its arguments — it cannot be the callee — so the name is
 * the only thing left to read.
 */
const isFactoryArgument = (node: ts.ObjectLiteralExpression): boolean =>
  node.parent !== undefined &&
  ts.isCallExpression(node.parent) &&
  ts.isIdentifier(node.parent.expression) &&
  FACTORY_NAMES.has(node.parent.expression.text)

const suitesBuildingAJob = (): string[] =>
  Object.entries(SUITES)
    .filter(([file, code]) => jobLiteralsIn(file, code) > 0)
    .map(([file]) => file)

/**
 * The lock, and why it exists at all.
 *
 * Six suites used to build their own `Job`, and one of them published a terminal status with no
 * `finishedAt` — a shape `settle` never writes. Converting them was one lot; the SIXTH escaped
 * two successive inventories and was found by a reviewer, which is what says a list cannot hold
 * this and a walk has to.
 *
 * The main process is out of reach on purpose, not by oversight: it cannot import a factory of
 * the renderer, and `main/assets/collector.test.ts` still writes its own.
 */
describe('no suite of the renderer builds its own job', () => {
  it('finds none', () => {
    expect(suitesBuildingAJob()).toEqual([])
  })

  /**
   * An empty result proves nothing unless the suites were opened. A floor rather than a tally,
   * as `import-cycles.test.ts` keeps one: it will not notice a handful going missing, but it
   * does notice a walk that stopped walking — which is how this check would watch nothing.
   */
  it('opened the suites to say so', () => {
    expect(Object.keys(SUITES).length).toBeGreaterThan(300)
    // The floor is load-bearing, and these two do NOT replace it — they close what it alone
    // misses. One per extension, because a glob narrowed to `.tsx` keeps a `.tsx` anchor green
    // while 219 `.ts` suites go unread: measured by a reviewer, who built exactly that.
    expect(Object.keys(SUITES)).toContain('../app/JobsStatus.test.tsx')
    expect(Object.keys(SUITES)).toContain('../helpers/generation.test.ts')
  })

  /** And it can fail: the shape the lot removed, and the near-misses it must not claim. */
  it('would see one written out, and leaves the near-misses alone', () => {
    const built = `const j = { id: 'a', kind: 'model', targetId: 'm', status: 'succeeded', progress: 1 }`
    const target = `const t = { kind: 'model', id: 'model_flux' }`
    const partial = `const p = { kind: 'model', targetId: 'm', status: 'queued' }`

    expect(jobLiteralsIn('probe.ts', built)).toBe(1)
    expect(jobLiteralsIn('probe.ts', target)).toBe(0)
    expect(jobLiteralsIn('probe.ts', partial)).toBe(0)
  })

  /**
   * The two halves of the exemption, which is where a guard of this kind goes wrong: overriding
   * every key through the factory is allowed, and the shape all six converted sites wrote — a
   * literal nested in an array inside the argument — is still seen.
   */
  it('spares what goes through the factory, and still sees what hides in an array', () => {
    const overridden = `job({ kind: 'model', targetId: 'm', status: 'failed', progress: 0.5 })`
    const aliased = `jobOf({ kind: 'model', targetId: 'm', status: 'failed', progress: 0.5 })`
    const nested = `useJobs.setState({ jobs: [{ kind: 'model', targetId: 'm', status: 'queued', progress: 0 }] })`
    // The hole a reviewer measured on the first spelling: exempting ANY call let a whole job
    // reach a function under test untouched — the seventh suite, walking straight through.
    const elsewhere = `applyProgress({ kind: 'model', targetId: 'm', status: 'queued', progress: 0 })`

    expect(jobLiteralsIn('probe.ts', overridden)).toBe(0)
    expect(jobLiteralsIn('probe.ts', aliased)).toBe(0)
    expect(jobLiteralsIn('probe.ts', nested)).toBe(1)
    expect(jobLiteralsIn('probe.ts', elsewhere)).toBe(1)
  })
})
