import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { PROJECT_TREES, SOURCE_ROOT, WHOLE_PROJECT, sourceFiles } from './sourceFiles'

/**
 * Under an `await`, no chain — neither `.then()` nor `.catch()`.
 *
 * Alban's ruling of 24/08. What it costs to leave alone is measured: 74 sites, all of them green
 * under typecheck, lint and the suite, because a chain under an `await` is a `try` nobody can
 * see. Three of the twenty rewritten by hand changed behaviour when translated naively — a `?.`
 * short-circuits the WHOLE chain, two `await`s folded into one block stopped running, and an
 * enclosing `try` swallowed an editor's failure as a catalogue's.
 *
 * What to write instead: `try { await … } catch { … }` where the failure is swallowed or a
 * sequel follows, with a line saying WHY it is swallowed; `orElse(promise, fallback)`
 * (`shared/promises.ts`) where the `.catch` only answers a value.
 *
 * **What this does NOT touch, and confusing the two breaks code**: `void promise.catch(() => {})`
 * on a promise nobody awaits. There is no `await`, and the empty `.catch` is what keeps an
 * `unhandledRejection` from killing the process. Turning one into `try/await/catch` would BLOCK
 * the caller.
 *
 * **Read by AST, never by grep**: a chain spans five lines, and a line-wise grep missed half of
 * them on the day this was written. Only a chain the `await` applies to DIRECTLY is a finding —
 * `await Promise.all(xs.map(x => f(x).catch(…)))` awaits the `all`, not the chain.
 */
const CHAINS = new Set(['then', 'catch'])

const chainsIn = (path: string): number[] => {
  const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true)
  const lines: number[] = []

  const walk = (node: ts.Node): void => {
    if (ts.isAwaitExpression(node)) {
      const call = node.expression
      if (
        ts.isCallExpression(call) &&
        ts.isPropertyAccessExpression(call.expression) &&
        CHAINS.has(call.expression.name.text)
      )
        lines.push(source.getLineAndCharacterOfPosition(node.getStart()).line + 1)
    }
    ts.forEachChild(node, walk)
  }
  walk(source)

  return lines
}

describe('no chain under await', () => {
  it(
    'lets no source file await a promise it also chains onto',
    () => {
      const found = PROJECT_TREES.flatMap(tree =>
        sourceFiles(tree).flatMap(path =>
          chainsIn(path).map(line => `${relative(SOURCE_ROOT, path)}:${line}`),
        ),
      )

      expect(found.sort()).toEqual([])
    },
    WHOLE_PROJECT,
  )
})
