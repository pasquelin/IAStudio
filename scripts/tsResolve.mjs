import { existsSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { URL, fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, resolve } from 'node:path'

/**
 * Lets a script under `scripts/` import the project's TypeScript the way the project writes it.
 *
 * Node strips types on the way in, but it resolves like ESM: a bare `./font` and an `@shared/…`
 * alias both fail. `collect-manual.ts` got away without this because everything it imports is a
 * TYPE, erased before resolution ever runs; a script needing a VALUE — a Zod schema, a table —
 * does not.
 *
 * 🛑 It fails LOUDLY: a specifier it cannot place is handed on untouched, so Node reports the
 * missing module rather than this silently resolving to something else.
 */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const ALIASES = [
  { prefix: '@shared/', root: join(ROOT, 'src', 'shared') },
  { prefix: '@main/', root: join(ROOT, 'src', 'main') },
  { prefix: '@game/', root: join(ROOT, 'src', 'game') },
  { prefix: '@/', root: join(ROOT, 'src', 'renderer', 'src') },
]

/** The spellings TypeScript lets an import leave out, in the order the compiler tries them. */
const SUFFIXES = ['', '.ts', '.tsx', '/index.ts', '/index.tsx']

function fileFor(path) {
  return SUFFIXES.map(suffix => `${path}${suffix}`).find(existsSync) ?? null
}

registerHooks({
  resolve(specifier, context, next) {
    const alias = ALIASES.find(one => specifier.startsWith(one.prefix))
    if (alias) {
      const found = fileFor(join(alias.root, specifier.slice(alias.prefix.length)))
      if (found) return next(pathToFileURL(found).href, context)
    }

    if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) {
      const found = fileFor(fileURLToPath(new URL(specifier, context.parentURL)))
      if (found) return next(pathToFileURL(found).href, context)
    }

    return next(specifier, context)
  },
})
