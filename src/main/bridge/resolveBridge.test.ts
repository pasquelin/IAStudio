import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  installResolveScript,
  resolveScriptFolder,
  resolveScriptPath,
  resolveScriptText,
} from './resolveBridge'

/**
 * A home of its own for every case: the real one holds somebody's Resolve, and a test that wrote
 * there would install the very thing this repository refuses to install without being asked.
 */
let home = ''

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), 'resolve-bridge-'))
})

afterEach(async () => {
  await rm(home, { recursive: true, force: true })
})

describe('where Resolve reads a script', () => {
  /**
   * `Utility` rather than `Comp` or `Tool`: those two are offered only while a composition is
   * open, and this script runs from the edit page.
   */
  it('names the per-user Utility folder, under the application support tree', () => {
    expect(resolveScriptFolder(home)).toBe(
      join(
        home,
        'Library',
        'Application Support',
        'Blackmagic Design',
        'DaVinci Resolve',
        'Fusion',
        'Scripts',
        'Utility',
      ),
    )
  })

  it('writes a .lua, which is the one language Resolve needs nothing installed for', () => {
    expect(resolveScriptPath(home).endsWith('.lua')).toBe(true)
  })
})

describe('the script itself', () => {
  /** Resolve owns the pool and the page; the bridge asks the OPEN project to take a file. */
  it('imports into the project that is open, rather than making one', () => {
    const script = resolveScriptText()

    expect(script).toContain('GetCurrentProject')
    expect(script).toContain('ImportTimelineFromFile')
    expect(script).not.toContain('CreateProject')
  })

  /** Every format the studio writes for an online room, or the row picks a file it cannot take. */
  it('offers the four extensions the studio writes an edit as', () => {
    const script = resolveScriptText()

    for (const extension of ['otio', 'edl', 'fcpxml', 'xml']) {
      expect(script).toContain(`*.${extension}`)
    }
  })

  /**
   * Run from anywhere but Resolve, `Resolve()` is not a function at all. Saying so beats a Lua
   * stack trace in a console the reader has to go looking for.
   */
  it('says where it has to run rather than failing on a missing global', () => {
    expect(resolveScriptText()).toContain('if not resolve then')
  })
})

describe('installing it', () => {
  it('creates the folders Resolve has not made yet, and answers where it wrote', async () => {
    const written = await installResolveScript(home)

    expect(written).toBe(resolveScriptPath(home))
    expect(await readFile(written, 'utf8')).toBe(resolveScriptText())
  })

  /** Installing twice is what a studio update means, and it must not fail on the second. */
  it('writes over a script already there', async () => {
    await installResolveScript(home)
    await installResolveScript(home)

    expect(await readFile(resolveScriptPath(home), 'utf8')).toBe(resolveScriptText())
  })
})
