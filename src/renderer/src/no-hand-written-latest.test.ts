import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { WINDOW_SOURCES } from './windowSources'

/**
 * Sites the React Compiler forbids from taking `useLatest`, MEASURED on 2026-08-18 and not
 * assumed: with the ref out of the dependency lists `react-hooks/exhaustive-deps` refuses it, and
 * with it in, `react-hooks/preserve-manual-memoization` answers « Compilation Skipped » — the
 * component then loses its automatic memoisation, on a canvas repainted every frame.
 *
 * Both read their mirror from a `useCallback` of a COMPONENT, where the repository's other sites
 * read theirs from an effect or a listener. That correlation holds over four files and is NOT
 * offered here as the cause; what is established is the pair of lint verdicts.
 */
const COMPILER_REFUSES = new Set([
  './panels/timeline/AnimationCanvas.tsx',
  './features/audio/components/ProgramMonitor.tsx',
])

/** The hook itself, which is the four lines rather than a copy of them. */
const CANONICAL = './hooks/useLatest.ts'

/** What `const X = useRef(V)` declares, by name, with the text of `V` and the line it sits on. */
type Mirror = { init: string; line: number }

/**
 * A ref built on a CONSTANT is a slot, never a mirror — `useRef(0)` reassigned `0` is a reset, and
 * `useRef(null)` reassigned `null` is a teardown. Measured: without this the sweep reported 33
 * sites for 2 real ones, and `CLAUDE.md` exempts exactly this family by name.
 */
const CONSTANT_KINDS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.NullKeyword,
  ts.SyntaxKind.TrueKeyword,
  ts.SyntaxKind.FalseKeyword,
  ts.SyntaxKind.NumericLiteral,
  ts.SyntaxKind.StringLiteral,
  ts.SyntaxKind.NoSubstitutionTemplateLiteral,
])

function isConstant(node: ts.Node): boolean {
  if (CONSTANT_KINDS.has(node.kind)) return true
  if (ts.isIdentifier(node)) return node.text === 'undefined'
  // The EMPTY array and object too, which is how a ref that gets cleared is built — `SpectrumBand`
  // empties its bands when the montage stops, and its own comment says so.
  if (ts.isArrayLiteralExpression(node)) return node.elements.length === 0
  return ts.isObjectLiteralExpression(node) && node.properties.length === 0
}

function refsIn(source: ts.SourceFile): Map<string, Mirror> {
  const refs = new Map<string, Mirror>()

  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      ts.isIdentifier(node.initializer.expression) &&
      node.initializer.expression.text === 'useRef' &&
      node.initializer.arguments.length === 1
    ) {
      const initial = node.initializer.arguments[0]
      if (initial && !isConstant(initial)) {
        refs.set(node.name.text, {
          init: initial.getText(source),
          line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
        })
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(source)
  return refs
}

/**
 * A ref REASSIGNED the very expression it was built from — which is `useLatest` and nothing else.
 *
 * Matching the reassigned text against the INITIAL text is what separates the two, and it is the
 * whole difficulty: a ref one WRITES (`engine.current = null`, `pulls.current = 0`) wears the same
 * shape, `CLAUDE.md` exempts it by name, and a detector reading only the left-hand side reported
 * eighteen sites for four real ones.
 */
function mirrorsIn(path: string, code: string): string[] {
  const source = ts.createSourceFile(path, code, ts.ScriptTarget.Latest, true)
  const refs = refsIn(source)
  if (refs.size === 0) return []

  const assigned = new Map<string, string[]>()
  const visit = (node: ts.Node): void => {
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isPropertyAccessExpression(node.left) &&
      node.left.name.text === 'current' &&
      ts.isIdentifier(node.left.expression) &&
      refs.has(node.left.expression.text)
    ) {
      const name = node.left.expression.text
      assigned.set(name, [...(assigned.get(name) ?? []), node.right.getText(source)])
    }
    ts.forEachChild(node, visit)
  }

  visit(source)

  // EVERY assignment must be the mirror, not just one: a ref the code also WRITES cannot become
  // `useLatest`, because `react-hooks/immutability` refuses writing into what a hook built. This is
  // the rule `CLAUDE.md` states through `InlineRename`, held here rather than listed by name.
  return [...assigned]
    .filter(([name, values]) => values.every(value => value === refs.get(name)?.init))
    .map(([name]) => `${path}:${refs.get(name)?.line} ${name}`)
}

describe('a ref that only mirrors the render it was built in', () => {
  it('is `useLatest`, never four lines written again', () => {
    const written = Object.entries(WINDOW_SOURCES)
      .filter(([path]) => path !== CANONICAL && !COMPILER_REFUSES.has(path))
      .flatMap(([path, code]) => mirrorsIn(path, code))

    expect(written).toEqual([])
  })

  it('would see one written by hand', () => {
    const code = [
      'function Panel({ rows }) {',
      '  const latest = useRef(rows)',
      '  useEffect(() => {',
      '    latest.current = rows',
      '  })',
      '}',
    ].join('\n')

    expect(mirrorsIn('probe.tsx', code)).toEqual(['probe.tsx:2 latest'])
  })

  /**
   * The half that costs the most to get wrong: a ref the effect WRITES is not this pattern, and
   * `CLAUDE.md` says so by name. Reading the left-hand side alone would report every one of them.
   */
  it('leaves alone a ref that is written rather than mirrored', () => {
    const code = [
      'function Panel({ documentId }) {',
      '  const engine = useRef(null)',
      '  const pulls = useRef(0)',
      '  useEffect(() => {',
      '    engine.current = new Engine(documentId)',
      '    pulls.current = 0',
      '  }, [documentId])',
      '}',
    ].join('\n')

    expect(mirrorsIn('probe.tsx', code)).toEqual([])
  })

  /** The two the compiler refuses are exempt by PATH, so a third arriving there is still reported. */
  it('holds the two exemptions to their own files', () => {
    for (const path of COMPILER_REFUSES) expect(WINDOW_SOURCES[path]).toBeDefined()
  })
})
