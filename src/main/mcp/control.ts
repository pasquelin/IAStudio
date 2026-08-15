import { rmSync, writeFileSync } from 'node:fs'
import type { Settings } from '@shared/domain/settings'
import { log } from '@main/log'
import type { McpEndpoint } from './endpoint'
import { startMcp, type McpDeps, type RunningMcp } from './server'

/**
 * Turning the server on and off, and telling the disk where it landed.
 *
 * Off is the default and off is what a fresh launch means when the setting says so: the port and
 * the token are minted per run, so nothing about a previous session survives into this one.
 */

export type McpControl = {
  /** Follows the setting. Safe to call with settings that changed nothing. */
  apply: (settings: Settings) => void
  /** Where it is listening, or `null` while it is off. */
  endpoint: () => McpEndpoint | null
  stop: () => Promise<void>
}

export type McpControlDeps = McpDeps & {
  /** Where the port and the token are written, so a client can be pointed here. */
  configPath: string
}

export function createMcpControl({ configPath, ...deps }: McpControlDeps): McpControl {
  let running: RunningMcp | null = null
  let wanted = false
  // Changes are serialised through one chain: the toggle is a checkbox, and two clicks in
  // quick succession would otherwise start a second server before the first had a port.
  let settling: Promise<void> = Promise.resolve()

  const publish = ({ port, token }: McpEndpoint): void => {
    // `0o600`: the token in it is the whole of the authentication, and the profile folder is
    // readable by every process running as this user.
    writeFileSync(configPath, `${JSON.stringify({ port, token }, null, 2)}\n`, { mode: 0o600 })
  }

  const unpublish = (): void => {
    // The file names a port nothing is listening on the moment the server stops, and a stale
    // one is how a client ends up talking to whatever took that port next.
    rmSync(configPath, { force: true })
  }

  const settle = (): void => {
    settling = settling
      .then(async () => {
        if (wanted && !running) {
          running = await startMcp(deps)
          publish(running)
          return
        }

        if (!wanted && running) {
          const stopping = running
          running = null
          unpublish()
          await stopping.close()
        }
      })
      .catch(error => {
        log.warn('mcp', `could not settle the server: ${String(error)}`)
      })
  }

  return {
    apply: settings => {
      if (settings.mcp.enabled === wanted) return
      wanted = settings.mcp.enabled
      settle()
    },

    endpoint: () => (running ? { port: running.port, token: running.token } : null),

    stop: async () => {
      wanted = false
      settle()
      await settling
    },
  }
}

/**
 * The one control this process has, reachable from where the settings change.
 *
 * A registry rather than a parameter, and for a plain reason of order: the settings store is
 * built before the services the server needs, and it is the store that hears a change. The same
 * shape the window uses to declare its confirmer.
 */
let followed: McpControl | null = null

export function followMcp(control: McpControl): void {
  followed = control
}

/** Called on every settings change. Does nothing until a control has been declared. */
export function applyMcpSettings(settings: Settings): void {
  followed?.apply(settings)
}

/** Where the server is, for the button that offers the command to reach it. */
export function mcpEndpoint(): McpEndpoint | null {
  return followed?.endpoint() ?? null
}
