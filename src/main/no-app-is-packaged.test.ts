import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { sitesIn } from './astSites'
import { PROJECT_TREES, SOURCE_ROOT, sourceFiles, WHOLE_PROJECT } from './sourceFiles'

const isElectronApp = (node: ts.Expression): boolean => ts.isIdentifier(node) && node.text === 'app'

/**
 * Whether a node reads `isPackaged` off `app`, written either way.
 *
 * `app['isPackaged']` is nobody's habit, which is the reason a guard has to read it: a rule a
 * rename tool can slip past is a rule that stops holding without saying so.
 */
function readsIsPackaged(node: ts.Node): boolean {
  if (ts.isPropertyAccessExpression(node))
    return isElectronApp(node.expression) && node.name.text === 'isPackaged'

  if (
    ts.isElementAccessExpression(node) &&
    (ts.isStringLiteral(node.argumentExpression) ||
      ts.isNoSubstitutionTemplateLiteral(node.argumentExpression))
  )
    return isElectronApp(node.expression) && node.argumentExpression.text === 'isPackaged'

  return false
}

function packagedReadsIn(path: string, source: string): string[] {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true)
  return sitesIn(file, path, readsIsPackaged)
}

/**
 * `app.isPackaged` answers about the executable's NAME, not about the build, and the dev run
 * renames the executable.
 *
 * Electron derives the flag from the basename of the running binary — anything other than
 * `electron` reads as packaged. `scripts/dev-app-identity.mjs` renames the bundle and its
 * executable to the product's name so development wears the studio's name and icon, which leaves
 * the flag reporting a packaged app in the middle of a dev run. `isDevelopment`
 * (`main/environment.ts`) reads `__DEV__`, injected by `define`, so it says what the build IS.
 *
 * Seven behaviours had already switched to their production side this way and were moved off the
 * flag — the window's entry point, DevTools, the log mirror, the Dock icon, the developer menu,
 * the reload guard and the single-instance lock. The updater was the
 * eighth and was missed, because it fails quietly: `checkForUpdates` ran during development and
 * only ever reached a log line. Nothing stopped a ninth, so this does.
 *
 * TWO blind spots, written down rather than left to be discovered:
 *
 * - **the identifier is read, never resolved.** Any object locally named `app` is caught, and a
 *   real `app.isPackaged` reached through a different name — a destructured `const { isPackaged }`
 *   or an aliased import — is not. Measured on 2026-08-13: `app` names the Electron module and
 *   nothing else across the four trees, so the strict reading costs no false positive today.
 * - **prose is not read**, which is deliberate: three files explain this very trap in their
 *   JSDoc, and a guard that fails on a sentence about itself would be deleted within the week.
 */
describe('no behaviour asks the executable whether the build is packaged', () => {
  const findingsOf = (): string[] =>
    PROJECT_TREES.flatMap(tree =>
      sourceFiles(tree).flatMap(path =>
        packagedReadsIn(relative(SOURCE_ROOT, path), readFileSync(path, 'utf8')),
      ),
    )

  it(
    'reads the build flag rather than the executable name, everywhere in the project',
    () => {
      expect(findingsOf()).toEqual([])
    },
    WHOLE_PROJECT,
  )

  // An empty result proves nothing unless the files were opened: pointed at a folder that does
  // not exist, the assertion above stays green. The trees are counted, not assumed.
  it('holds every tree the project ships', () => {
    const counts = PROJECT_TREES.map(tree => sourceFiles(tree).length)

    expect(counts.every(count => count > 0)).toBe(true)
    expect(counts.reduce((total, count) => total + count, 0)).toBeGreaterThan(100)
  })

  it('sees the read that sent the updater looking for a feed in development', () => {
    expect(
      packagedReadsIn('probe.ts', 'const updates = make({ isPackaged: app.isPackaged })'),
    ).toEqual(['probe.ts:1'])
  })

  it('reads the access spelled through a string, in both quotings', () => {
    expect(packagedReadsIn('probe.ts', "const on = app['isPackaged']")).toEqual(['probe.ts:1'])
    expect(packagedReadsIn('probe.ts', 'const on = app[`isPackaged`]')).toEqual(['probe.ts:1'])
  })

  it('leaves the build flag and the port that carries it alone', () => {
    expect(packagedReadsIn('probe.ts', 'const on = !isDevelopment')).toEqual([])
    expect(packagedReadsIn('probe.ts', 'createUpdates({ isPackaged: !isDevelopment })')).toEqual([])
    expect(packagedReadsIn('probe.ts', 'type Ports = { isPackaged: boolean }')).toEqual([])
  })

  // A guard that reads its own prose is a guard that fails on a sentence about it.
  it('reads neither a mention of the flag nor a string that spells it', () => {
    expect(
      packagedReadsIn('probe.ts', '/** Not `app.isPackaged`: the dev run renames it. */'),
    ).toEqual([])
    expect(packagedReadsIn('probe.ts', "const name = 'app.isPackaged'")).toEqual([])
  })
})
