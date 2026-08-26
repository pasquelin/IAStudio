import { readFileSync } from 'node:fs'
import { builtinModules } from 'node:module'
import { dirname, join, relative, resolve, sep } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { SOURCE_ROOT, WHOLE_PROJECT, sourceFiles } from './sourceFiles'
import { testFilesUnder } from './wideGuards'

/**
 * 🛑 What `src/game` may reach, held at ZERO.
 *
 * The runtime has to run TWICE — inside the studio, and inside an exported game that ships none
 * of it. So nothing under `src/game` imports the studio: not the window, not the main process,
 * not React, not Electron, and not a node builtin a browser has never had. What a host needs
 * from the studio arrives as a PARAMETER, which is why `host/` gets no exception here.
 *
 * A ratchet, and it is the only thing holding this: the compiler, eslint and every other suite
 * are green on `import { useScenes } from '@/stores/scenes'` written inside `src/game`. Knip does
 * report an unused export of this tree — measured 2026-08-26, and not what the audit expected —
 * but it says nothing about where an import comes FROM.
 *
 * Suites are swept along with the sources: a test that reaches into the studio drags the whole
 * of it into a tree whose point is not to need it.
 */
const GAME = join(SOURCE_ROOT, 'game')

/** What only the studio uses. A third-party library is fine; the studio's own stack is not. */
const STUDIO_STACK = /^(react|react-dom|react-i18next|i18next|zustand|electron)(\/|$)/

const ALLOWED_ALIASES = ['@shared/', '@game/']

const FORBIDDEN_ALIASES = ['@/', '@main/']

/** Both spellings: `node:fs` and the bare `fs`, which no rule of this repository refuses. */
const NODE_BUILTINS = new Set(builtinModules)

/**
 * Every specifier of one file that leaves the tree, as `<file> -> <specifier>`.
 *
 * Relative paths are resolved textually rather than against the disk: what matters is where the
 * specifier POINTS, and a file that does not exist yet points somewhere all the same.
 */
function reachesOutOf(file: string, code: string): string[] {
  const said = (specifier: string): string => `${relative(SOURCE_ROOT, file)} -> ${specifier}`

  return ts.preProcessFile(code, true, true).importedFiles.flatMap(({ fileName }) => {
    const bare = fileName.split('?')[0] ?? fileName
    if (bare.startsWith('.')) {
      const target = resolve(dirname(file), bare)
      return target.startsWith(GAME + sep) ? [] : [said(fileName)]
    }
    if (ALLOWED_ALIASES.some(alias => bare.startsWith(alias))) return []
    if (FORBIDDEN_ALIASES.some(alias => bare.startsWith(alias))) return [said(fileName)]
    const root = bare.split('/')[0] ?? bare
    const isNode = bare.startsWith('node:') || NODE_BUILTINS.has(root)
    return isNode || STUDIO_STACK.test(bare) ? [said(fileName)] : []
  })
}

/**
 * 🛑 What a SHIPPED file takes from `@shared/`, when it is not a type.
 *
 * `src/game` is MIT and the rest of the repository is PolyForm Noncommercial — that carve-out is
 * what makes an exported game its author's to sell, and it holds only while nothing here carries
 * another tree's code into the bundle. A type is gone by compile time; a value is not.
 *
 * Suites are out: a test ships nowhere, and reading a shared constant to assert against is fair.
 */
function valuesTakenFromShared(file: string, code: string): string[] {
  const parsed = ts.createSourceFile(file, code, ts.ScriptTarget.ESNext, true)

  return parsed.statements.flatMap(statement => {
    if (!ts.isImportDeclaration(statement)) return []
    const from = statement.moduleSpecifier
    if (!ts.isStringLiteral(from) || !from.text.startsWith('@shared/')) return []

    const said = [`${relative(SOURCE_ROOT, file)} -> ${from.text}`]
    // No clause at all is `import '@shared/x'`, which runs the module for its side effects.
    const clause = statement.importClause
    if (!clause) return said
    if (clause.isTypeOnly) return []

    const bindings = clause.namedBindings
    const named = bindings && ts.isNamedImports(bindings) ? bindings.elements : undefined
    return !clause.name && named && named.every(element => element.isTypeOnly) ? [] : said
  })
}

/** The window's bridge, reached through the global rather than through an import. */
const usesTheBridge = (code: string): boolean => /\bwindow\.studio\b/.test(code)

const gameFiles = (): string[] => testFilesUnder(GAME, /\.tsx?$/)

describe('what the game runtime may reach', () => {
  it(
    'imports nothing of the studio, from any of its files',
    () => {
      const found = gameFiles().flatMap(file => reachesOutOf(file, readFileSync(file, 'utf8')))

      expect(found.sort()).toEqual([])
    },
    WHOLE_PROJECT,
  )

  it(
    'takes no VALUE from the shared tree, which is under other terms',
    () => {
      const found = sourceFiles(GAME).flatMap(file =>
        valuesTakenFromShared(file, readFileSync(file, 'utf8')),
      )

      expect(found.sort()).toEqual([])
    },
    WHOLE_PROJECT,
  )

  it('reaches the studio through no global either', () => {
    const found = gameFiles().filter(file => usesTheBridge(readFileSync(file, 'utf8')))

    expect(found.map(file => relative(SOURCE_ROOT, file))).toEqual([])
  })

  /**
   * An empty result proves nothing unless the files were opened. A floor rather than a tally: it
   * separates « the walk works » from « the walk found one file ».
   */
  it('opened the tree to say so', () => {
    expect(gameFiles().length).toBeGreaterThan(20)
  })

  /** And it can fail — the four spellings that leave the tree, and the three that do not. */
  it('would see the studio reached for, however it was spelt', () => {
    const from = join(GAME, 'host', 'studioHost.ts')

    expect(reachesOutOf(from, "import { useScenes } from '@/stores/scenes'")).toEqual([
      'game/host/studioHost.ts -> @/stores/scenes',
    ])
    expect(reachesOutOf(from, "import { log } from '@main/log'")).toEqual([
      'game/host/studioHost.ts -> @main/log',
    ])
    expect(reachesOutOf(from, "import { memo } from 'react'")).toEqual([
      'game/host/studioHost.ts -> react',
    ])
    expect(reachesOutOf(from, "import { readFile } from 'node:fs/promises'")).toEqual([
      'game/host/studioHost.ts -> node:fs/promises',
    ])
    // The bare spelling of a builtin, which nothing else in this repository refuses.
    expect(reachesOutOf(from, "import { readFileSync } from 'fs'")).toEqual([
      'game/host/studioHost.ts -> fs',
    ])
    expect(reachesOutOf(from, "import { x } from '../../renderer/src/stores/scenes'")).toEqual([
      'game/host/studioHost.ts -> ../../renderer/src/stores/scenes',
    ])

    expect(reachesOutOf(from, "import type { Ref } from '@shared/domain/ref'")).toEqual([])
    expect(reachesOutOf(from, "import { createRingLog } from './ringLog'")).toEqual([])
    expect(reachesOutOf(from, "import RAPIER from '@dimforge/rapier3d-compat'")).toEqual([])
  })

  /** And so can the other half: three spellings that carry code, and two that carry nothing. */
  it('would see a value taken from the shared tree', () => {
    const from = join(GAME, 'host', 'studioHost.ts')
    const taken = ['game/host/studioHost.ts -> @shared/domain/asset']

    expect(valuesTakenFromShared(from, "import { assetUrl } from '@shared/domain/asset'")).toEqual(
      taken,
    )
    expect(valuesTakenFromShared(from, "import '@shared/domain/asset'")).toEqual(taken)
    expect(
      valuesTakenFromShared(from, "import { type Asset, assetUrl } from '@shared/domain/asset'"),
    ).toEqual(taken)

    expect(
      valuesTakenFromShared(from, "import type { Asset } from '@shared/domain/asset'"),
    ).toEqual([])
    expect(
      valuesTakenFromShared(from, "import { type Asset } from '@shared/domain/asset'"),
    ).toEqual([])
  })
})
