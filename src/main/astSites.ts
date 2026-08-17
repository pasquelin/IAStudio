/**
 * The walk every AST guard of the main process writes, held once.
 *
 * Three of them spelt the same recursion: descend the tree, and on each node the rule recognises,
 * push where it sits as `path:line`. What differs between the guards is the rule alone, which is
 * the argument here.
 *
 * `sourceFiles.ts` is the other half — it says WHICH files are read, this says how a finding is
 * located inside one. A guard borrowing this still imports that one for its trees, so
 * `wideGuards.ts` keeps recognising it through `borrowsTheSweep`; adding an import of this
 * module alone would NOT be enough to stay in the short loop.
 */
import ts from 'typescript'

/**
 * Every node of `subtree`, in source order.
 *
 * For a rule that GATHERS rather than recognises — one that has to carry a name or a count out of
 * the tree, which a boolean cannot. `sitesIn` is this walk with the answer narrowed to locations;
 * a guard needing more takes this and stays on the one recursion.
 */
export function walkIn(subtree: ts.Node, visit: (node: ts.Node) => void): void {
  visit(subtree)
  ts.forEachChild(subtree, child => walkIn(child, visit))
}

/** Where `node` sits, as `path:line` with a 1-based line — the coordinate a reader opens. */
export function siteOf(file: ts.SourceFile, path: string, node: ts.Node): string {
  return `${path}:${file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1}`
}

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

  walkIn(file, node => {
    if (recognises(node)) found.push(siteOf(file, path, node))
  })

  return found
}
