import ts from 'typescript'

/** What a script may name, and the only thing it may: `@studio` is types, erased on compile. */
export const STUDIO_MODULE = '@studio'

export type Transpiled = { code: string } | { trouble: string; line: number }

/**
 * TypeScript to what the sandbox runs, and nothing else.
 *
 * 🛑 `transpileModule`, never a program: the types are Monaco's business, and asking for them
 * here would mean a whole compiler host over a project the editor has already read. What this
 * owes is a refusal that names the line — an author who imported `node:fs` must be told, not
 * handed a `require` the machine does not hold.
 */
export function transpile(source: string): Transpiled {
  const named = foreignImport(source)
  if (named) return { trouble: named.module, line: named.line }

  const held = ts.transpileModule(withoutStudio(source), {
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
 * 🛑 The `@studio` import, taken out and replaced by an EMPTY LINE.
 *
 * `defineScript` and `game` are globals of the sandbox, not a module it can require — the import
 * exists so an editor can type the file, and `isolatedModules` would otherwise keep it as a
 * `require` the machine does not hold. Emptied rather than deleted so a fault still names the
 * line an author sees.
 */
const withoutStudio = (source: string): string =>
  source
    .split('\n')
    .map(line => (/^\s*import\b[^'"]*['"]@studio['"]/.test(line) ? '' : line))
    .join('\n')

/**
 * The first import that is not `@studio`, with the line it stands on.
 *
 * Read as text rather than through the AST: `transpileModule` parses the file again anyway, and
 * what this needs is the line an editor opens — which a scanner gives and a diagnostic would not
 * for a module that resolves nowhere.
 */
function foreignImport(source: string): { module: string; line: number } | null {
  const lines = source.split('\n')
  for (let at = 0; at < lines.length; at++) {
    const line = lines[at] ?? ''
    const named = /^\s*(?:import|export)\b[^'"]*from\s*['"]([^'"]+)['"]/.exec(line)
    const bare = /^\s*import\s*['"]([^'"]+)['"]/.exec(line)
    const held = named?.[1] ?? bare?.[1]
    if (held !== undefined && held !== STUDIO_MODULE) return { module: held, line: at + 1 }
  }
  return null
}
