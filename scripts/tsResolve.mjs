import { existsSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { URL, fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, resolve } from 'node:path'

/**
 * Lets a script import the project's TypeScript the way the project writes it: Node strips types
 * but resolves like ESM, so a bare `./font` and an `@shared/…` alias both fail.
 *
 * 🛑 A specifier it cannot place is handed on untouched, so Node reports the missing module
 * rather than this resolving to something else. The alias table is the SEVENTH copy in the
 * repository, and the only one no config derives — `pnpm ui:schema` breaks if one moves.
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
