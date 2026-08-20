import { useEffect } from 'react'
import type { StudioBridge } from '@shared/ipc'
import { getBridge } from '@/services/bridge'
import { useLatest } from './useLatest'

/**
 * Arms a native menu row for the tab in FRONT, and for no other — an export, a capture, anything
 * a row asks of the document being looked at. The event goes to the window rather than to a
 * document, and a hidden tab stays mounted: without this, two open skies answer one click of the
 * same row, and both open a folder dialog.
 *
 * The subscription is rebuilt only as the tab changes side, so what `listen` captured when it
 * subscribed is what the bridge calls. Sound while a mounted document keeps its id, which Dockview
 * guarantees by keying panels on it; a surface that changed document in place would need more.
 */
export function useExportMenu(
  inFront: boolean,
  listen: (bridge: StudioBridge) => () => void,
): void {
  const latest = useLatest(listen)

  useEffect(() => {
    const bridge = getBridge()
    if (!bridge || !inFront) return

    return latest.current(bridge)
  }, [inFront, latest])
}
