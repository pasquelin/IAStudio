import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS, type Settings } from '@shared/domain/settings'
import { createMcpControl, type McpControl } from './control'

/**
 * The file that carries the token, and the switch that writes it.
 *
 * Driven against a real folder rather than a stubbed filesystem: what this file is about is a
 * file — its contents, its mode, and above all whether it is still there afterwards. Every defect
 * this suite was written for was a lifecycle one, and none of them is visible from the inside.
 */

let folder = ''
let control: McpControl | null = null

const settings = (enabled: boolean): Settings => ({ ...DEFAULT_SETTINGS, mcp: { enabled } })

const configPath = (): string => join(folder, 'mcp.json')

beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), 'scenario-mcp-'))
})

afterEach(async () => {
  await control?.stop()
  control = null
  await rm(folder, { recursive: true, force: true })
  vi.restoreAllMocks()
})

function running(): McpControl {
  control = createMcpControl({
    run: () => Promise.resolve({ ok: true }),
    version: '1.2.3',
    configPath: configPath(),
  })
  return control
}

async function exists(path: string): Promise<boolean> {
  return await stat(path).then(
    () => true,
    () => false,
  )
}

describe('the file a client is pointed at', () => {
  it('names the port and the token once the server is on', async () => {
    const mcp = running()
    mcp.apply(settings(true))
    await vi.waitFor(async () => expect(await exists(configPath())).toBe(true))

    const written: unknown = JSON.parse(await readFile(configPath(), 'utf8'))
    expect(written).toEqual({ port: mcp.endpoint()?.port, token: mcp.endpoint()?.token })
  })

  /**
   * The token is the whole door — a caller with no `Origin` is admitted by design — and this is
   * the only secret the studio writes in clear. At the default mode it lands world-readable.
   */
  it('keeps it to this user alone', async () => {
    const mcp = running()
    mcp.apply(settings(true))
    await vi.waitFor(async () => expect(await exists(configPath())).toBe(true))

    // The low nine bits: the rest is the file type, which is not what this is about.
    expect((await stat(configPath())).mode & 0o777).toBe(0o600)
  })

  it('takes it away again when the switch goes off', async () => {
    const mcp = running()
    mcp.apply(settings(true))
    await vi.waitFor(async () => expect(await exists(configPath())).toBe(true))

    mcp.apply(settings(false))
    await vi.waitFor(async () => expect(await exists(configPath())).toBe(false))
  })

  /**
   * A crash, a kill, or a quit that raced its own cleanup leaves a file naming a port nothing is
   * listening on — and the next process to take that port inherits a client pointed at it. There
   * is no other moment to catch it: the switch starts off, so `apply(false)` changes nothing.
   */
  it('clears one left behind by a previous run, even switched off', async () => {
    await writeFile(configPath(), '{"port":51834,"token":"stale"}\n')

    const mcp = running()
    mcp.apply(settings(false))

    await vi.waitFor(async () => expect(await exists(configPath())).toBe(false))
  })

  // `stop` is awaited at quit rather than fired off beside it — the removal must land before the
  // process is gone, which is the whole reason the file is written at all.
  it('is gone once stopping has settled', async () => {
    const mcp = running()
    mcp.apply(settings(true))
    await vi.waitFor(async () => expect(await exists(configPath())).toBe(true))

    await mcp.stop()

    expect(await exists(configPath())).toBe(false)
  })
})

describe('the switch', () => {
  it('says nothing is listening while it is off', () => {
    expect(running().endpoint()).toBeNull()
  })

  /**
   * `apply` compares against what was last wanted, so a failed start that left it `true` made
   * every later `apply(true)` a no-op: a ticked checkbox, nothing listening, and no way back but
   * untick-and-retick.
   */
  it('can be tried again after a start that failed', async () => {
    const mcp = running()
    // A folder where the file cannot be written: the publish fails, and with it the start.
    control = createMcpControl({
      run: () => Promise.resolve({ ok: true }),
      version: '1.2.3',
      configPath: join(folder, 'nowhere', 'mcp.json'),
    })

    control.apply(settings(true))
    await vi.waitFor(() => expect(control?.endpoint()).toBeNull())

    // The retry reaches a folder that exists, and this time it comes up.
    await control.stop()
    control = mcp
    mcp.apply(settings(true))

    await vi.waitFor(() => expect(mcp.endpoint()).not.toBeNull())
  })
})
