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

const underBuildCondition = (node: ts.Node): boolean =>
  ts.findAncestor(
    node,
    up => ts.isIfStatement(up) && /isDevelopment/.test(up.expression.getText()),
  ) !== undefined

function recordingIn(path: string, source: string): { sites: string[]; conditional: string[] } {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true)
  const sites: string[] = []
  const conditional: string[] = []

  walkIn(file, node => {
    if (!callsRecordLogsTo(node)) return
    sites.push(siteOf(file, path, node))
    if (underBuildCondition(node)) conditional.push(siteOf(file, path, node))
  })

  return { sites, conditional }
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
    expect(entry().sites).not.toEqual([])
  })

  it('installs it outside any question about the build', () => {
    expect(entry().conditional).toEqual([])
  })

  it('sees the mistake the mirror invites', () => {
    expect(
      recordingIn('probe.ts', 'if (isDevelopment) recordLogsTo(createLogFile(directory))')
        .conditional,
    ).toEqual(['probe.ts:1'])
  })

  it('leaves the mirror alone', () => {
    expect(recordingIn('probe.ts', 'if (isDevelopment) mirrorLogsTo(send)').sites).toEqual([])
  })
})
