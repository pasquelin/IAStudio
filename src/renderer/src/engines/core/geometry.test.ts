import ts from 'typescript'
import { describe, expect, it } from 'vitest'

/**
 * Every engine module, as text. Read through Vite rather than through `fs`, like
 * `no-hardcoded-text.test.ts` reads the components: the renderer has no filesystem, and a test
 * living here does not get one.
 *
 * Suites and fixtures included, unlike the text guards which exclude them. A local `type Point`
 * in a suite cannot be auto-imported wrongly — it is not exported — but two of them were living
 * in the painters' suites, and a guard that says « nowhere else » has to mean it. This file reads
 * itself too: its own examples sit inside strings, which the parser below does not mistake for
 * declarations.
 */
const ENGINES: Record<string, string> = import.meta.glob('../**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
})

/** The glob key of the one module allowed to declare them — Vite spells the neighbour `./`. */
const HOME = './geometry.ts'

/**
 * The names this guard houses — narrow on purpose.
 *
 * `Viewport`, `hitTest`, `addNode`, `removeNode`, `textNode`, `modelNode` and `playsThrough` also
 * exist twice or more across the engines and are deliberately absent: those collide on a name
 * while carrying DIFFERENT shapes, so the compiler catches a wrong import. `Size` and `Point` were
 * spelt identically in seven places, which is why they needed a house and the others do not.
 */
const HOUSED: readonly string[] = ['Size', 'Point']

/**
 * What this holds, exactly, and it is less than its subject.
 *
 * It compares NAMES, so the same shape under another name walks straight past it — and three
 * already do, all older than this guard: `scene/bone-picking.ts` (`Pointer`),
 * `texture/derive/offscreen.ts` (`PictureSize`) and `canvas/CanvasEngine.test.ts` (`Pair`).
 * Absorbing them is a lot of its own, because a name-matching guard cannot then keep them in.
 *
 * It reads `engines/` only: the same declaration in `stores/`, `spaces/`, `panels/` or `shared/`
 * is invisible here. And it reads `.ts`; there is no `.tsx` under `engines/` today, which is a
 * measurement about this tree rather than a rule about it.
 *
 * A guard whose silence reads wider than its reach is the one its next reader disarms — the
 * neighbour at `stores/no-bare-shared-word-export.test.ts` writes the same warning for the same
 * reason.
 */
const declares = (code: string): string[] => {
  const source = ts.createSourceFile('module.ts', code, ts.ScriptTarget.Latest, true)
  const found: string[] = []
  const walk = (node: ts.Node): void => {
    const named = ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node)
    if (named && HOUSED.includes(node.name.text)) found.push(node.name.text)
    // A re-export hands the name back out under a second module, which is the ambiguous
    // auto-import this house exists to close — declaring it again is only one way to get there.
    if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause))
      for (const element of node.exportClause.elements)
        if (HOUSED.includes(element.name.text)) found.push(element.name.text)
    ts.forEachChild(node, walk)
  }
  walk(source)
  return found
}

describe('the shapes every engine paints with', () => {
  it('are declared, and handed back out, by one module in engines/ only', () => {
    const elsewhere = Object.entries(ENGINES)
      .filter(([path]) => path !== HOME)
      .flatMap(([path, code]) => declares(code).map(name => `${path} declares ${name}`))

    expect(elsewhere).toEqual([])
  })

  it('are both declared in that module', () => {
    expect(declares(ENGINES[HOME] ?? '').sort()).toEqual(['Point', 'Size'])
  })

  /**
   * An empty result proves nothing unless the modules were opened. A floor rather than a tally: it
   * will not notice a handful going missing, but it does notice a glob that stopped matching —
   * which is how this check would pass while reading nothing.
   */
  it('opened the engines to say so', () => {
    expect(Object.keys(ENGINES).length).toBeGreaterThan(100)
  })

  /** And it can fail. The spellings that put a name back out, and the ones that do not. */
  it('would see one handed out again, however it was written', () => {
    expect(declares('export type Point = { x: number; y: number }')).toEqual(['Point'])
    expect(declares('type Size = { width: number; height: number }')).toEqual(['Size'])
    expect(declares('export interface Size { width: number }')).toEqual(['Size'])
    expect(declares("export type { Point } from '../core/geometry'")).toEqual(['Point'])
    expect(declares("export { type Size } from '../core/geometry'")).toEqual(['Size'])

    // Importing is the whole point of the house; only re-exporting reopens the ambiguity.
    expect(declares("import type { Point } from '../core/geometry'")).toEqual([])
    expect(declares('export type Rect = { x: number; y: number }')).toEqual([])
    expect(declares("export type { ClipEdge } from './timeline-state'")).toEqual([])
  })
})
