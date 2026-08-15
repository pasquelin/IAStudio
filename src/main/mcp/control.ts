import { rm } from 'node:fs/promises'
import type { Settings } from '@shared/domain/settings'
import { log } from '@main/log'
import { writeAtomic, writeQueue } from '@main/persistence'
import type { McpEndpoint } from './endpoint'
import type { McpDeps, RunningMcp } from './server'

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
  // The toggle is a checkbox, and two clicks in quick succession would otherwise start a second
  // server before the first had a port. The same queue the studio's other small files use.
  const queue = writeQueue()

  const publish = async ({ port, token }: McpEndpoint): Promise<void> => {
    // Through a staging copy, like every other file the studio keeps: a client reading while
    // this is written would otherwise catch a truncated token and be refused for it.
    await writeAtomic(configPath, `${JSON.stringify({ port, token }, null, 2)}\n`)
  }

  const unpublish = async (): Promise<void> => {
    // The file names a port nothing is listening on the moment the server stops, and a stale
    // one is how a client ends up talking to whatever took that port next.
    await rm(configPath, { force: true })
  }

  const settle = (): Promise<void> =>
    queue
      .next(async () => {
        if (wanted && !running) {
          /**
           * Loaded here and not at the top of the file, which is the point of the whole
           * arrangement: the MCP SDK pulls some two hundred modules, zod among them, and this
           * setting is off by default. A static import would put that on the launch of every
           * studio that never opens the door — on the one path that blocks the main loop from
           * end to end.
           */
          const { startMcp } = await import('./server')
          running = await startMcp(deps)
          await publish(running)
          return
        }

        if (!wanted && running) {
          const stopping = running
          running = null
          await unpublish()
          await stopping.close()
        }
      })
      .catch((error: unknown) => {
        log.warn('mcp', `could not settle the server: ${String(error)}`)
      })

  return {
    apply: settings => {
      if (settings.mcp.enabled === wanted) return
      wanted = settings.mcp.enabled
      void settle()
    },

    endpoint: () => (running ? { port: running.port, token: running.token } : null),

    stop: async () => {
      wanted = false
      await settle()
    },
  }
}
