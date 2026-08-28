import { readFileSync } from 'node:fs'
import { builtinModules } from 'node:module'
import { dirname, relative, resolve } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { SOURCE_ROOT, WHOLE_PROJECT } from './sourceFiles'

/**
 * 🛑 What an EXPORTED game's bundle reaches, held to a list.
 *
 * `game-imports.test.ts` holds `src/game` to the engine alone; this holds the other half — the
 * glue that turns a scene document into a world, which lives in the window's tree because it
 * reads the window's types. A shortcut taken there ships React, the stores and Electron inside
 * somebody's game, and nothing else would say so: the bundle builds, the page opens.
 */
const ENTRY = resolve(SOURCE_ROOT, 'renderer/src/game/exportEntry.ts')

/** What only the studio uses. A third-party library is fine; the studio's own stack is not. */
const STUDIO_STACK = /^(react|react-dom|react-i18next|i18next|zustand|electron)(\/|$)/

const NODE_BUILTINS = new Set(builtinModules)

/** Where a game's own code lives: the engine, what both sides share, and the scene translation. */
const ALLOWED_FOLDERS: readonly string[] = [
  'game/',
  'shared/',
  'renderer/src/game/',
  'renderer/src/engines/',
]

/**
 * The one file outside them, named rather than a folder opened.
 *
 * `newId` is `crypto.randomUUID()` and nothing else — a browser has it. Widening the list to
 * `helpers/` would let in whatever lands there next, which is how a deny list failed.
 */
const ALLOWED_FILES: readonly string[] = ['renderer/src/helpers/ids']

const ALIASES: readonly { prefix: string; root: string }[] = [
  { prefix: '@/', root: resolve(SOURCE_ROOT, 'renderer/src') },
  { prefix: '@game/', root: resolve(SOURCE_ROOT, 'game') },
  { prefix: '@shared/', root: resolve(SOURCE_ROOT, 'shared') },
]

/** Where a specifier points, or `null` for a package. Textual: what matters is the target. */
function resolved(from: string, specifier: string): string | null {
  const bare = specifier.split('?')[0] ?? specifier
  if (bare.startsWith('.')) return resolve(dirname(from), bare)

  const alias = ALIASES.find(one => bare.startsWith(one.prefix))
  return alias ? resolve(alias.root, bare.slice(alias.prefix.length)) : null
}

const sourceOf = (file: string): string | null => {
  for (const suffix of ['.ts', '.tsx', '/index.ts', '/index.tsx', '']) {
    try {
      return readFileSync(`${file}${suffix}`, 'utf8')
    } catch {
      // The next spelling, or a package this sweep does not follow.
    }
  }
  return null
}

/** Every file the bundle reaches from its entry, and every package it names on the way. */
function swept(from: string = ENTRY): { files: Set<string>; packages: Set<string> } {
  const files = new Set<string>()
  const packages = new Set<string>()
  const queue = [from]

  while (queue.length > 0) {
    const file = queue.pop()
    if (file === undefined || files.has(file)) continue

    const code = sourceOf(file)
    if (code === null) continue

    files.add(file)
    for (const { fileName } of ts.preProcessFile(code, true, true).importedFiles) {
      const target = resolved(file, fileName)
      if (target === null) packages.add(fileName)
      else queue.push(target)
    }
  }

  return { files, packages }
}

/** Swept once and read by both blocks below: the walk parses 124 files, and running it a
 * second time would also let the two disagree about the baseline. */
const REACHED = swept()

describe('what an exported game carries', () => {
  const reached = REACHED

  /**
   * 🛑 The two cases below are `toEqual([])`, so a sweep that found NOTHING would pass both — a
   * typo in `ENTRY` or a resolver that stopped resolving reads exactly like a clean bundle.
   */
  it('opened the bundle to say so', () => {
    expect(reached.files.size).toBeGreaterThan(20)
    expect([...reached.packages]).toContain('three')
  })

  /**
   * 🛑 An ALLOW list, not a deny list. Written the other way it named five folders, and
   * `@/services/bridge` — which answers `null` outside the studio, silently — was in none of
   * them. What a game may reach is small enough to name; what it may not is not.
   */
  it(
    'reaches only the engine, the shared tree and the glue that reads a scene',
    () => {
      const strayed = [...reached.files]
        .map(file => relative(SOURCE_ROOT, file))
        .filter(
          path =>
            !ALLOWED_FOLDERS.some(one => path.startsWith(one)) && !ALLOWED_FILES.includes(path),
        )

      expect(strayed.sort()).toEqual([])
    },
    WHOLE_PROJECT,
  )

  it(
    'names no package of the studio stack, and no builtin a browser has never had',
    () => {
      const forbidden = [...reached.packages].filter(
        one => STUDIO_STACK.test(one) || one.startsWith('node:') || NODE_BUILTINS.has(one),
      )

      expect(forbidden.sort()).toEqual([])
    },
    WHOLE_PROJECT,
  )
})

/**
 * 🛑 What showing an interface would ADD to a game's bundle, held as a budget.
 *
 * The renderer is not wired into `exportEntry.ts` yet — that is the export lot — so the weight
 * is read the only way it can be today: the sources the interface renderer reaches, minus those
 * the bundle already carries. A budget rather than a tally, and it may only ever shrink: a
 * `.ora` reader or a font parser dragged in behind a convenience import turns this red on the
 * day it is written, instead of on the day somebody downloads a game.
 *
 * Source bytes, not built ones: `resources/gameRuntime` is written by `pnpm game:runtime` and no
 * suite runs it. The two move together, which is what a budget needs.
 *
 * 🛑 Its blind spot, in clear: a line of COMMENT weighs as much here as a line of code, where
 * the bundle carries none of it. Documenting the format therefore costs budget — measured on
 * 2026-08-28, one constant and its three lines of why moved this by 417 bytes. The alternative
 * is stripping trivia off an AST for a number nobody would trust more.
 */
const UI_RENDERER = resolve(SOURCE_ROOT, 'game/host/domUiRenderer.ts')

/** Measured 2026-08-28 at 56 231 bytes. Lower it whenever the sweep says it can be lowered. */
const UI_BUDGET = 57_000

describe('what an interface would add to an exported game', () => {
  const drawing = swept(UI_RENDERER)
  const added = [...drawing.files].filter(file => !REACHED.files.has(file))

  it('opened the interface tree to say so', () => {
    expect(added.length).toBeGreaterThan(3)
  })

  it('stays inside its budget', () => {
    const bytes = added.reduce((total, file) => total + (sourceOf(file)?.length ?? 0), 0)

    expect(bytes).toBeLessThanOrEqual(UI_BUDGET)
  })

  /** It carries no package of its own, which is the whole of « no new dependency ». */
  it('names no package the bundle does not already hold', () => {
    expect([...drawing.packages].filter(one => !REACHED.packages.has(one)).sort()).toEqual([])
  })
})
