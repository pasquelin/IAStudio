import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, defaultSettings } from '@shared/domain/settings'
import { startMcp, type RunningMcp } from './server'

/**
 * That what a person installs has not moved, now that a development run opens its way in on its
 * own.
 *
 * Four things guard that door — the loopback, a token new every launch, a port the operating
 * system picks, and a setting off unless asked for — and the fourth is the one this lot touches.
 * A relaxation held by nothing but an intention is one that spreads: written here so the day a
 * fixed port or a shipped default creeps in, it is a red test rather than a discovery.
 *
 * The loopback and the origin are `access.test.ts` and `server.test.ts`; only what THIS lot could
 * have loosened is here.
 */

const started: RunningMcp[] = []

afterEach(async () => {
  for (const server of started.splice(0)) await server.close()
})

async function launched(): Promise<RunningMcp> {
  // No token and no port passed: exactly what `createMcpControl` does at every start.
  const server = await startMcp({ run: () => Promise.resolve({ ok: true }), version: '1.2.3' })
  started.push(server)
  return server
}

describe('what a person installs', () => {
  /**
   * The delegations matter as much as the switch: a development default that armed one would let
   * a client move files with no question on screen, which is the studio's whole consent model.
   */
  it('keeps the way in shut, and a development run differs by that alone', () => {
    expect(defaultSettings(false)).toEqual(DEFAULT_SETTINGS)
    expect(defaultSettings(false).mcp.enabled).toBe(false)

    const development = defaultSettings(true)

    expect(development.mcp.enabled).toBe(true)
    expect({ ...development, mcp: { ...development.mcp, enabled: false } }).toEqual(
      DEFAULT_SETTINGS,
    )
  })

  /** Whichever was free, never a number of ours: a fixed port is one another program can wait on. */
  it('takes the port the operating system gives it', async () => {
    const [first, second] = [await launched(), await launched()]

    expect(first.port).not.toBe(second.port)
    expect(first.port).toBeGreaterThan(0)
  })

  /** 32 bytes of `randomBytes`, hex, and nothing about one launch survives into the next. */
  it('mints a new token at every launch', async () => {
    const [first, second] = [await launched(), await launched()]

    expect(first.token).toMatch(/^[0-9a-f]{64}$/)
    expect(second.token).not.toBe(first.token)
  })
})
