import ts from 'typescript'

/** What a script may name, and the only thing it may: `@studio` is types, erased on compile. */
const STUDIO_MODULE = '@studio'

export type Transpiled = { code: string } | { trouble: string; line: number }

/**
 * TypeScript to what the sandbox runs, and nothing else.
 *
 * 🛑 `transpileModule`, never a program: the types are Monaco's business, and asking for them here
 * would mean a whole compiler host over a project the editor has already read.
 */
export function transpile(source: string): Transpiled {
  const read = imports(source)
  if ('trouble' in read) return read

  const held = ts.transpileModule(read.code, {
    compilerOptions: {
      // CommonJS, so `export default` lands on `exports` — which is what the sandbox reads back.
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      isolatedModules: true,
      removeComments: false,
    },
  })

  return { code: held.outputText }
}

/**
 * 🛑 Parsed, never scanned line by line: an import spread over three lines is ordinary TypeScript.
 * `@studio` is emptied rather than deleted — it is globals, so `isolatedModules` would keep a
 * `require` the machine does not hold, and the blank lines keep a fault on its author's line.
 */
function imports(source: string): { code: string } | { trouble: string; line: number } {
  const file = ts.createSourceFile('script.ts', source, ts.ScriptTarget.ES2020, true)
  const emptied: { from: number; to: number }[] = []

  for (const statement of file.statements) {
    const named =
      (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier)
        ? statement.moduleSpecifier.text
        : null
    if (named === null) continue

    if (named !== STUDIO_MODULE) {
      return {
        trouble: named,
        line: file.getLineAndCharacterOfPosition(statement.getStart(file)).line + 1,
      }
    }
    emptied.push({ from: statement.getStart(file), to: statement.end })
  }

  let code = source
  // Backwards, so an earlier replacement does not move the offsets of a later one.
  for (const span of emptied.reverse()) {
    const blanked = source.slice(span.from, span.to).replace(/[^\n]/g, '')
    code = code.slice(0, span.from) + blanked + code.slice(span.to)
  }
  return { code }
}
