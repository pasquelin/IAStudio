import { describe, expect, it } from 'vitest'

/**
 * Every source of the renderer, as text — read through Vite rather than through `fs`, for the
 * reason `no-hardcoded-text.test.ts` gives: a test living here has no filesystem.
 */
const SOURCES: Record<string, string> = import.meta.glob(
  ['../**/*.ts', '../**/*.tsx', '!../**/*.test.ts', '!../**/*.test.tsx'],
  { query: '?raw', import: 'default', eager: true },
)

/**
 * Three panels had each written the same `lazy(() => import('./DynamicForm'))`, and a fourth
 * caller would have written a fourth. Counted rather than reviewed: the copies were identical, so
 * nothing about reading one of them said the other two existed.
 */
describe('the deferred generation form', () => {
  it('is declared in exactly one place', () => {
    const declaring = Object.entries(SOURCES)
      .filter(([, source]) => /import\([^)]*DynamicForm'\)/.test(source))
      .map(([path]) => path)

    expect(declaring).toEqual(['./dynamicFormLazy.ts'])
  })

  /**
   * The half `Generator.test.tsx` used to hold on its own: this module exists to be imported
   * statically, so a static import of the form HERE would pull zod and react-hook-form back into
   * everything that reads it — the three panels included, and silently.
   */
  it('reaches the form only through the deferred import', () => {
    const source = SOURCES['./dynamicFormLazy.ts'] ?? ''

    expect(source).toMatch(/lazy\(/)
    expect(source).not.toMatch(/^import .*DynamicForm'/m)
  })
})
