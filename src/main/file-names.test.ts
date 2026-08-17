import { readFileSync } from 'node:fs'
import { basename, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PROJECT_TREES, SOURCE_ROOT, WHOLE_PROJECT, sourceFiles } from './source-files'

/**
 * How a source file is named, and where it sits. Decided 2026-08-17; nothing held it before, and
 * three conventions had grown side by side — 324 camelCase, 307 kebab-case, 225 PascalCase.
 *
 * **A capital is earned by what the file HANDS OUT, not by what it happens to declare.** A file
 * named `CanvasEngine.ts` must export a component or a class called `CanvasEngine`; everything
 * else is camelCase. So the case of a name says what is behind it, which is the whole point of
 * picking one — and the rule reads the same in both directions, which is what makes it checkable.
 *
 * That phrasing was reached by measuring, not by reasoning. « Exports a class » was the first
 * try, and it demanded a capital for `main/project/store.ts`, which exports `NoProjectError`
 * among its functions: **an error class is a detail of a module, never what names a file.**
 * Requiring the name to MATCH is what tells the two apart, and it dropped six false findings.
 *
 * A hook lives under `hooks/`, wherever its caller does. And a `.tsx` holds ONE component: a
 * second one that grows there is a file waiting to be written, and its parent's folder is where
 * it goes.
 */
const RULE = 'a capital is earned by exporting a component or a class of that name'

/**
 * The debt, counted rather than listed — and this is the weaker of the two ratchets this
 * repository uses, on purpose.
 *
 * Listing the paths would tie the guard to names about to change: the migration that empties these
 * counts is under way. A count cannot see a swap — one file renamed while another is added
 * off-convention leaves it green — and that hole is real for as long as the numbers are not zero.
 *
 * **When a count reaches zero it is deleted, not kept at zero**: the assertion then reads as the
 * rule itself, and the next offending file fails on sight. The hooks did exactly that, one lot
 * after this guard landed — twelve, then none, and the constant went with them.
 */
const KNOWN_OFF_CONVENTION = 286
const KNOWN_CROWDED = 37

/** `.d.ts` names the module it declares, not a module of ours: `sherpa-onnx-node` is a package. */
const isDeclaration = (path: string): boolean => path.endsWith('.d.ts')

/** The segment before the first dot — `audio.worker.ts` is named `audio`, and that is camelCase. */
const stem = (path: string): string => basename(path).split('.')[0] ?? ''

const isCamelCase = (name: string): boolean => /^[a-z][a-zA-Z0-9]*$/.test(name)
const isPascalCase = (name: string): boolean => /^[A-Z][a-zA-Z0-9]*$/.test(name)

/**
 * Every component or class a file declares, by name, deduplicated.
 *
 * Four spellings, and the deduplication is why: `export const LayerRow = memo(function LayerRow(`
 * declares one thing and matches two of them. They demand a lowercase second letter, which keeps
 * `TONES` and `GLYPHS` out — a constant is not a component. Classes are in: `ErrorBoundary` is
 * one, because `getDerivedStateFromError` still has no hook equivalent in React 19.
 */
function componentsIn(code: string): Set<string> {
  const declared = [
    ...code.matchAll(/(?:^|\n)(?:export )?(?:default )?function ([A-Z][a-z]\w*)/g),
    ...code.matchAll(/(?:^|\n)(?:export )?const ([A-Z][a-z]\w*) = (?:\(|memo|forwardRef)/g),
    ...code.matchAll(/(?:^|\n)(?:export )?class ([A-Z][a-z]\w*)/g),
    ...code.matchAll(/= memo\(function ([A-Z][a-z]\w*)/g),
  ]

  // `?? ''`: the group is filled whenever the pattern matched, which the type cannot know.
  return new Set(declared.map(match => match[1] ?? ''))
}

/**
 * Whether the file hands out a component or a class under `name` — a TYPE of that name does not
 * count. `GpuPipeline.ts` exports `type GpuPipeline` and `createGpuPipeline`, which makes it a
 * module with a well-named type, not a file whose subject is a class.
 */
function handsOut(code: string, name: string): boolean {
  return new RegExp(
    `(?:^|\\n)export (?:default )?(?:function|class|const) ${name}\\b|` +
      `(?:^|\\n)export (?:default )?const ${name} = memo\\(`,
  ).test(code)
}

const projectSources = PROJECT_TREES.flatMap(tree => sourceFiles(tree)).filter(
  path => !isDeclaration(path),
)

const reported = (path: string): string => relative(SOURCE_ROOT, path)

describe(`file names — ${RULE}`, () => {
  it(
    'holds every name to the case its exports earn',
    () => {
      const wrong = projectSources.filter(path => {
        const name = stem(path)

        return isPascalCase(name) ? !handsOut(readFileSync(path, 'utf8'), name) : !isCamelCase(name)
      })

      expect(wrong.map(reported).sort()).toHaveLength(KNOWN_OFF_CONVENTION)
    },
    WHOLE_PROJECT,
  )

  /**
   * A hook is found by its name, wherever it was written. `hooks/` is the one place a reader
   * looks for one, and twelve of them were somewhere else the day this guard was written — five
   * under `panels/inspector`, three under `spaces/audio`. They moved the lot after, so this reads
   * as the rule rather than as a budget, and the next stray one fails on sight.
   */
  it(
    'keeps every hook under a hooks folder',
    () => {
      const strayed = projectSources.filter(
        path => /^use[A-Z]/.test(stem(path)) && !path.includes(`${sep}hooks${sep}`),
      )

      expect(strayed.map(reported).sort()).toEqual([])
    },
    WHOLE_PROJECT,
  )

  /**
   * One component per file — counted whether the extra one is exported or not. A private
   * sub-component is exactly the case this is about: it is invisible from outside, so nothing
   * else would ever report it, and it is how a 40-line file becomes a 400-line one.
   *
   * Declarations, not exports, and that is the one place the two questions part ways: what names
   * a file is what it hands out, but what crowds a file is what lives in it.
   */
  it(
    'gives every component a file of its own',
    () => {
      const crowded = projectSources.filter(
        path => path.endsWith('.tsx') && componentsIn(readFileSync(path, 'utf8')).size > 1,
      )

      expect(crowded.map(reported).sort()).toHaveLength(KNOWN_CROWDED)
    },
    WHOLE_PROJECT,
  )
})
