/**
 * The walk every AST guard of the main process writes, held once.
 *
 * Three of them spelt the same recursion: descend the tree, and on each node the rule recognises,
 * push where it sits as `path:line`. What differs between the guards is the rule alone, which is
 * the argument here.
 *
 * `source-files.ts` is the other half — it says WHICH files are read, this says how a finding is
 * located inside one. A guard borrowing this still imports that one for its trees, so
 * `wide-guards.ts` keeps recognising it through `borrowsTheSweep`; adding an import of this
 * module alone would NOT be enough to stay in the short loop.
 */
import ts from 'typescript'

/**
 * Every site of `file` the rule recognises, as `path:line` with a 1-based line.
 *
 * `path` is passed rather than taken from `file.fileName`: guards report a path relative to
 * `src/`, so the reader can open what the failure names, while the parser is given the absolute
 * one. Two names for one file, and the reported one is the argument.
 */
export function sitesIn(
  file: ts.SourceFile,
  path: string,
  recognises: (node: ts.Node) => boolean,
): string[] {
  const found: string[] = []

  const walk = (node: ts.Node): void => {
    if (recognises(node)) {
      const { line } = file.getLineAndCharacterOfPosition(node.getStart(file))
      found.push(`${path}:${line + 1}`)
    }

    ts.forEachChild(node, walk)
  }

  walk(file)
  return found
}
