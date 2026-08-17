import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { sitesIn } from './astSites'
import { PROJECT_TREES, SOURCE_ROOT, sourceFiles, WHOLE_PROJECT } from './sourceFiles'

/**
 * Whether an argument is a literal spelling a `{{hole}}` — quoted, backticked, or a regexp.
 *
 * A regexp's `text` is its SOURCE, where the braces are escaped: `/\{\{size\}\}/g` never contains
 * `{{` until the backslashes come out. Reading it raw is why the first version of this rule was
 * blind to the one site that had already been bitten.
 */
function namesAHole(argument: ts.Expression | undefined): boolean {
  if (!argument) return false

  if (
    ts.isStringLiteral(argument) ||
    ts.isNoSubstitutionTemplateLiteral(argument) ||
    ts.isRegularExpressionLiteral(argument)
  )
    return argument.text.replace(/\\/g, '').includes('{{')

  return false
}

const handRolledFillsIn = (path: string, source: string): string[] => {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true)

  return sitesIn(file, path, node => {
    if (!ts.isCallExpression(node)) return false
    const target = node.expression
    return (
      ts.isPropertyAccessExpression(target) &&
      (target.name.text === 'replace' || target.name.text === 'replaceAll') &&
      namesAHole(node.arguments[0])
    )
  })
}

/**
 * The main process fills a translation's `{{holes}}` in one place, and `String.replace` is not it.
 *
 * The window has i18next. This side reads `TRANSLATIONS[language]` straight and used to fill by
 * hand, four sites and four shapes: `replace('{{title}}', …)`, `replace('{{name}}', …)`, two of
 * those chained, and `replace(/\{\{size\}\}/g, …)`. The last one is the whole argument — a literal
 * first argument rewrites the FIRST match only, `skyboxFaceSize` is `{{size}} × {{size}}` in both
 * bundles, and that site had to be respelled with a regular expression once someone saw the second
 * one standing in a menu. The other three were one translator away from the same defect: repeating
 * a name inside a sentence is ordinary language, not a mistake, and no test named the risk.
 *
 * `fillHoles` (`shared/i18n`) fills every occurrence of every hole it is handed. This refuses the
 * SHAPE that made the defect possible — which is less than refusing the defect, and the batch's
 * adversarial review measured exactly how much less.
 *
 * THREE blind spots, written rather than left to be found:
 *
 * - **the pattern has to be a literal AT the call.** Measured as invisible here, and the first two
 *   reintroduce the original defect in full: `const HOLE = '{{name}}'` then `text.replace(HOLE, n)`
 *   · `text.replace(new RegExp('\\{\\{name\\}\\}'), n)`, which without `g` also rewrites one match
 *   · a template literal WITH a substitution, `` `{{${key}}}` `` · `` String.raw`{{name}}` ``.
 *   Closing them needs to know what an identifier holds, which one file at a time cannot say.
 * - **a hole nobody FILLS is a different defect, and no shape betrays it** — the call is simply
 *   not written. Only output catches that: `menu/template.test.ts` sweeps every label of every
 *   submenu in both languages, `project/documentDialogs.test.ts` reads the message it builds, and
 *   `project/handlers.test.ts` reads the name an extracted texture is written under.
 * - **the receiver is not typed, and `{{` is not always a translation.** `s.replace('{{', '')` —
 *   stripping braces, which a bundle tool or the pseudo-locale would do — is reported, as is a
 *   `replace` on something that is not a string. Nothing in `src/main` writes either, and the rule
 *   reads the method's name exactly as `no-bare-locale-compare.test.ts` reads `sort`.
 */
describe('no translation is filled by hand in the main process', () => {
  // The one file that cannot obey the rule, because it IS the rule: `fillHoles` is a `replace`
  // over a pattern naming a hole. Its path is checked below rather than trusted — a helper that
  // moves without this following would leave the whole rule matching nothing but itself.
  const THE_ONE_THAT_FILLS = 'shared/i18n/index.ts'

  const findingsOf = (): string[] =>
    PROJECT_TREES.flatMap(tree =>
      sourceFiles(tree).flatMap(path =>
        handRolledFillsIn(relative(SOURCE_ROOT, path), readFileSync(path, 'utf8')),
      ),
    )

  it(
    'routes every hole of the main process through fillHoles',
    () => {
      // Both halves in one sentence, and it names the offender rather than showing a count:
      // nothing outside the helper, and the helper still there.
      expect(findingsOf().map(site => site.split(':')[0])).toEqual([THE_ONE_THAT_FILLS])
    },
    WHOLE_PROJECT,
  )

  it('reads the hand-rolled fill in each of the shapes it was written in', () => {
    expect(handRolledFillsIn('probe.ts', "text.replace('{{title}}', title)")).toEqual([
      'probe.ts:1',
    ])
    expect(handRolledFillsIn('probe.ts', 'text.replace(`{{name}}`, name)')).toEqual(['probe.ts:1'])
    expect(handRolledFillsIn('probe.ts', 'text.replace(/\\{\\{size\\}\\}/g, size)')).toEqual([
      'probe.ts:1',
    ])
  })

  it('leaves a replace that has nothing to do with a translation alone', () => {
    expect(handRolledFillsIn('probe.ts', "path.replace('\\\\', '/')")).toEqual([])
    expect(handRolledFillsIn('probe.ts', 'const spelt = `{{name}}`')).toEqual([])
  })
})
