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
function swept(): { files: Set<string>; packages: Set<string> } {
  const files = new Set<string>()
  const packages = new Set<string>()
  const queue = [ENTRY]

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

describe('what an exported game carries', () => {
  const reached = swept()

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
