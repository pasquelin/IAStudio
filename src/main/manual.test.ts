import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { buildManual } from '../../scripts/collect-manual.ts'
import manual from '@shared/manual.json'

/**
 * That what the application ships IS what `docs/` says today.
 *
 * The whole reason the manual is compiled rather than read from disk at runtime: a chapter
 * edited without rerunning `pnpm manual:collect` is a red gate here, not a quiet drift. A manual
 * shipped stale is worse than one absent — the reader has no way to tell, and the studio answers
 * a question with last week's answer.
 *
 * Here rather than beside `shared/manual.i18n.test.ts` for the reason `licences.test.ts` gives:
 * this one needs the filesystem, and `tsconfig.web.json` types no `node:` module.
 */
const ROOT = fileURLToPath(new URL('../..', import.meta.url))

describe('the shipped manual', () => {
  it('is what docs/ says today', () => {
    expect(manual).toEqual(buildManual(ROOT))
  })
})
