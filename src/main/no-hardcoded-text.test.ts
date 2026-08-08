import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const MAIN = dirname(fileURLToPath(import.meta.url))

/** The calls that put words on screen without a window: OS dialogs and notifications. */
const SHOWS_TEXT = new Set([
  'showMessageBox',
  'showMessageBoxSync',
  'showErrorBox',
  'showOpenDialog',
  'showSaveDialog',
  'showOpenDialogSync',
  'showSaveDialogSync',
  'Notification',
])

/** The fields of those calls a user reads. `defaultPath` is a path, `filters[].extensions` a list. */
const READ_FIELDS = new Set([
  'body',
  'buttonLabel',
  'buttons',
  'checkboxLabel',
  'detail',
  'message',
  'name',
  'subtitle',
  'title',
])

function sourceFiles(directory: string, into: string[] = []): string[] {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name)
    if (statSync(path).isDirectory()) sourceFiles(path, into)
    else if (path.endsWith('.ts') && !path.endsWith('.test.ts')) into.push(path)
  }

  return into
}

/** What a call is named, whether it is `dialog.showMessageBox(…)` or `new Notification(…)`. */
function calledName(node: ts.CallExpression | ts.NewExpression, source: ts.SourceFile): string {
  const target = node.expression
  if (ts.isPropertyAccessExpression(target)) return target.name.getText(source)
  return target.getText(source)
}

function findingsIn(path: string, code: string): string[] {
  const source = ts.createSourceFile(path, code, ts.ScriptTarget.Latest, true)
  const findings: string[] = []

  /** Literals right inside the options object — the shape someone writes when in a hurry. */
  const inspect = (node: ts.Node, call: string): void => {
    if (ts.isPropertyAssignment(node) && READ_FIELDS.has(node.name.getText(source))) {
      const written = [
        node.initializer,
        ...(ts.isArrayLiteralExpression(node.initializer) ? node.initializer.elements : []),
      ]

      for (const value of written) {
        if (!ts.isStringLiteral(value) || value.text.trim() === '') continue
        const { line } = source.getLineAndCharacterOfPosition(value.getStart(source))
        findings.push(`${path}:${line + 1} ${call} ${node.name.getText(source)}="${value.text}"`)
      }
    }

    ts.forEachChild(node, child => inspect(child, call))
  }

  const visit = (node: ts.Node): void => {
    if ((ts.isCallExpression(node) || ts.isNewExpression(node)) && node.arguments !== undefined) {
      const call = calledName(node, source)
      if (SHOWS_TEXT.has(call)) {
        for (const argument of node.arguments) inspect(argument, call)
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(source)
  return findings
}

/**
 * The main process draws the one surface the bundles could be forgotten on: a native dialog has
 * no component and no `t`, so its wording is written where the call is. Everything it shows is
 * read from `TRANSLATIONS[windowLanguage()]` today, and this is what keeps it that way.
 *
 * Only literals written into the call itself are seen — a string reaching it through a variable
 * is beyond a check that reads one file at a time. That is the shape worth catching: the one
 * somebody types in a hurry.
 */
describe('the main process', () => {
  it('never writes the words a dialog shows', () => {
    const findings = sourceFiles(MAIN).flatMap(path =>
      findingsIn(relative(MAIN, path), readFileSync(path, 'utf8')),
    )

    expect(findings).toEqual([])
  })

  it('would see a message typed into the call', () => {
    const found = findingsIn(
      'probe.ts',
      "dialog.showMessageBox(window, { message: 'Discard your work?', buttons: ['Cancel', 'Discard'] })",
    )

    expect(found).toHaveLength(3)
  })

  it('leaves alone what the caller reads from a bundle, and what is not a word', () => {
    const quiet = [
      'dialog.showMessageBox(window, { message: t.discardTitle, buttons: [t.cancel, t.discard] })',
      "dialog.showSaveDialog({ defaultPath: 'scene.glb' })",
      "log.warn('renderer', { message: 'a technical line nobody reads on screen' })",
    ]

    expect(quiet.flatMap((code, index) => findingsIn(`probe${index}.ts`, code))).toEqual([])
  })
})
