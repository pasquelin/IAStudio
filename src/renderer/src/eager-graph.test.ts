import { describe, expect, it } from 'vitest'

/**
 * What the first screen has to evaluate, walked from the entry point through STATIC imports only.
 *
 * Reading one file's text proves nothing here: what matters is what lands in the opening chunk,
 * and `import { X as Y }`, a multi-line specifier list, a sibling module importing the same thing,
 * or a `zod/v4` subpath all put it back while the file under watch stays untouched.
 *
 * Sources come from Vite rather than from `node:fs`: the renderer project carries no Node types.
 */

const SOURCES: Record<string, () => Promise<string>> = {
  ...import.meta.glob<string>('./**/*.{ts,tsx}', { query: '?raw', import: 'default' }),
  ...import.meta.glob<string>('../../shared/**/*.ts', { query: '?raw', import: 'default' }),
}

const ALIASES: readonly [string, string][] = [
  ['@/', './'],
  ['@shared/', '../../shared/'],
]

const EXTENSIONS = ['.ts', '.tsx']

/** `import … from 'x'` and `export … from 'x'`, but never `import type` nor `await import(`. */
const STATIC_IMPORT =
  /(?:^|\n)\s*(?:import|export)\s+(?!type\s)(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]/g

/** Collapses `.` and `..` into a key the glob would produce, with no `node:path` in sight. */
function normalise(path: string): string {
  const parts: string[] = []
  for (const part of path.split('/')) {
    if (part === '.' || part === '') continue
    if (part === '..' && parts.length > 0 && parts.at(-1) !== '..') parts.pop()
    else parts.push(part)
  }
  return `./${parts.join('/')}`
}

function folderOf(key: string): string {
  return key.slice(0, key.lastIndexOf('/'))
}

/**
 * The key the glob knows this module by. A folder import lands on its `index`, and what it
 * imports next is relative to THAT file — resolving to the folder sends every specifier below
 * it into the void, silently.
 */
function keyOf(candidate: string): string | null {
  const base = normalise(candidate)
  for (const path of [base, ...EXTENSIONS.flatMap(ext => [base + ext, `${base}/index${ext}`])]) {
    if (path in SOURCES) return path
  }
  return null
}

function specifierKey(specifier: string, from: string): string | null {
  for (const [prefix, target] of ALIASES) {
    if (specifier.startsWith(prefix)) return keyOf(target + specifier.slice(prefix.length))
  }
  return specifier.startsWith('.') ? keyOf(`${folderOf(from)}/${specifier}`) : null
}

/** Every package and every source file the entry point reaches without an `import()`. */
async function eagerGraph(): Promise<{ packages: Set<string>; files: Set<string> }> {
  const packages = new Set<string>()
  const files = new Set<string>()
  const queue = [keyOf('./main.tsx')]

  while (queue.length > 0) {
    const key = queue.pop()
    if (key === null || key === undefined || files.has(key)) continue
    const load = SOURCES[key]
    if (load === undefined) continue
    files.add(key)

    for (const match of (await load()).matchAll(STATIC_IMPORT)) {
      const specifier = match[1]
      if (specifier === undefined) continue
      if (
        specifier.startsWith('.') ||
        specifier.startsWith('@/') ||
        specifier.startsWith('@shared/')
      )
        queue.push(specifierKey(specifier, key))
      // A bare specifier is a package; `zod/v4` and `zod/mini` are still zod.
      else
        packages.add(specifier.startsWith('@') ? specifier : (specifier.split('/')[0] ?? specifier))
    }
  }

  return { packages, files }
}

describe('the opening chunk', () => {
  it('walks a graph worth asserting on', async () => {
    // Guards the walker, and it has earned its place: resolving a folder import to the folder
    // rather than to its `index` cut every branch below it, and a hundred files still came back
    // — enough to pass a count, not enough to catch anything.
    const { packages, files } = await eagerGraph()

    expect(packages).toContain('react')
    expect(packages).toContain('dockview-react')
    expect(files).toContain('./app/tool-components.ts')
    expect(files).toContain('./panels/generator/Generator.tsx')
    // The panels read this one eagerly for `referencePictures` — which is exactly why zod had to
    // leave it. If it stops being reached, the assertions below stop meaning anything.
    expect(files).toContain('./helpers/dynamic-form.ts')
  })

  // Deferred by `Generator.tsx` on 8 August: −219,62 kB, three quarters of it zod.
  it('never reaches the generation form, nor what validates it', async () => {
    const { files } = await eagerGraph()

    expect(files).not.toContain('./design/DynamicForm.tsx')
    expect(files).not.toContain('./helpers/dynamic-form-schema.ts')
  })

  it('never reaches the form libraries', async () => {
    const { packages } = await eagerGraph()

    expect(packages).not.toContain('zod')
    expect(packages).not.toContain('react-hook-form')
    expect(packages).not.toContain('@hookform/resolvers/zod')
  })

  // Deferred by `engines/core/fonts.ts` on 8 August: −483,56 kB. Same property, same guard.
  it('never reaches the font parser', async () => {
    const { packages } = await eagerGraph()

    expect(packages).not.toContain('opentype.js')
  })
})
