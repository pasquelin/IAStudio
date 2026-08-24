import { useEffect, useState } from 'react'
import type { McpState } from '@shared/ipc'
import { getBridge } from '@/services/bridge'

/**
 * Where the door onto this machine is listening, pushed by the main process — the same shape as
 * `useWindowState`, and for the same reason: the setting says what was WANTED, and a server that
 * failed to bind leaves it saying so with nothing listening.
 *
 * Subscribed rather than re-read on the setting: the port is bound after the setting that asked
 * for it has already been broadcast.
 */
export function useMcpState(): McpState {
  const [state, setState] = useState<McpState>({ port: null })

  useEffect(() => {
    const bridge = getBridge()
    if (!bridge) return

    void bridge.mcp.state().then(setState)
    return bridge.mcp.onState(setState)
  }, [])

  return state
}
