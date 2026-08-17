import { describe, expect, it } from 'vitest'
import { WRITTEN_SOURCES } from '@/design/test-harness'

/**
 * `resetForTests` is offered on `DocumentStore<S>`, the type `document-io` receives — so it sits
 * in the autocompletion of production code that has a store in hand, and what it does there is
 * exactly the accident `step` guards against: every closed document reopened at once, silently.
 *
 * The name says who may call it and this says it again in a way that fails. Read as text through
 * the renderer-wide sweep rather than by import, for the reason every written-form guard here is:
 * a rule about who NAMES something cannot be expressed by what imports it.
 */
const HOOKS = ['resetForTests', 'resetDocumentStoresForTests']

/**
 * Where the hook may be named. `WRITTEN_SOURCES` already drops `*.test.ts(x)`, so what is listed
 * here is what a suite reaches THROUGH: the fixtures, the setup file that calls it between cases,
 * and the module that declares it.
 */
const ALLOWED = ['/stores/documentStore.ts', '/test-setup-stores.ts', '-fixtures.ts']

const isAllowed = (path: string): boolean => ALLOWED.some(allowed => path.endsWith(allowed))

describe('the reset hook of a document store', () => {
  it('is named by no production module', () => {
    const offenders = WRITTEN_SOURCES.filter(
      ([path, source]) => !isAllowed(path) && HOOKS.some(hook => source.includes(hook)),
    ).map(([path]) => path)

    expect(offenders).toEqual([])
  })

  /**
   * Renaming either hook would leave the rule above green over nothing at all — it reads names,
   * so a name nobody writes any more passes it. The two places that must go on naming them are
   * where one is declared and where the suites are handed the other.
   */
  it('is still named where the guard expects to find it', () => {
    const named = WRITTEN_SOURCES.filter(([, source]) =>
      HOOKS.some(hook => source.includes(hook)),
    ).map(([path]) => path)

    expect(named).toContain('../stores/documentStore.ts')
    expect(named).toContain('../test-setup-stores.ts')
  })
})
