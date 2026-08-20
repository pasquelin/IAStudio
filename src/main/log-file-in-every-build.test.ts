import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { siteOf, walkIn } from './astSites'

const ENTRY = 'main/index.ts'

const callsRecordLogsTo = (node: ts.Node): node is ts.CallExpression =>
  ts.isCallExpression(node) &&
  ts.isIdentifier(node.expression) &&
  node.expression.text === 'recordLogsTo'

function asksTheBuild(node: ts.Node): boolean {
  if (ts.isIfStatement(node)) return /isDevelopment/.test(node.expression.getText())
  if (ts.isConditionalExpression(node)) return /isDevelopment/.test(node.condition.getText())
  return false
}

/**
 * What is INSTALLED, as opposed to what is merely called: the argument is read as TEXT, so a
 * helper hiding the condition behind another name would pass. `null` is what a ternary collapses
 * to, and it installs nothing.
 */
function installs(call: ts.CallExpression): boolean {
  const argument = call.arguments[0]
  if (argument === undefined || argument.kind === ts.SyntaxKind.NullKeyword) return false
  return !/isDevelopment/.test(argument.getText())
}

function recordingIn(path: string, source: string): { installed: string[]; conditional: string[] } {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true)
  const installed: string[] = []
  const conditional: string[] = []

  walkIn(file, node => {
    if (!callsRecordLogsTo(node)) return
    if (ts.findAncestor(node, asksTheBuild) !== undefined || !installs(node))
      conditional.push(siteOf(file, path, node))
    else installed.push(siteOf(file, path, node))
  })

  return { installed, conditional }
}

/**
 * The file destination belongs in EVERY build, and the mirror beside it is the trap: it reads
 * `if (isDevelopment)` for good reason — its lines cross IPC — and copying that line would send
 * the log back to the terminal a packaged run never has.
 */
describe('the log reaches a file whatever the build', () => {
  const entry = (): ReturnType<typeof recordingIn> =>
    recordingIn(ENTRY, readFileSync(join(import.meta.dirname, 'index.ts'), 'utf8'))

  it('installs the file destination from the entry point', () => {
    expect(entry().installed).not.toEqual([])
  })

  it('installs it outside any question about the build', () => {
    expect(entry().conditional).toEqual([])
  })

  it('sees the mistake the mirror invites, written as a statement', () => {
    expect(
      recordingIn('probe.ts', 'if (isDevelopment) recordLogsTo(createLogFile(directory))')
        .conditional,
    ).toEqual(['probe.ts:1'])
  })

  // The same defect one rewrite away, and the first draft of this guard was blind to it: the
  // ternary sits INSIDE the call, so no ancestor of it asks anything about the build.
  it('sees it written as a ternary, and as an install of nothing', () => {
    expect(
      recordingIn('probe.ts', 'recordLogsTo(isDevelopment ? createLogFile(directory) : null)')
        .conditional,
    ).toEqual(['probe.ts:1'])
    expect(recordingIn('probe.ts', 'recordLogsTo(null)').installed).toEqual([])
  })

  it('leaves the mirror alone', () => {
    expect(recordingIn('probe.ts', 'if (isDevelopment) mirrorLogsTo(send)').installed).toEqual([])
  })
})
