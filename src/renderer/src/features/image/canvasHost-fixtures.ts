import { PNG_HEAD } from '@/game/game-fixtures'
import { bytesToBase64 } from '@/helpers/base64'
import { canvasHostStub } from '@/stores/canvas-fixtures'
import type { CanvasHost } from './canvasHosts'

/**
 * A fake engine behind the canvas port. Written once so a member added to `CanvasHost` is one
 * edit here rather than one per case — nine of them had spelled the same stubs out. What a
 * headless run can honestly stand in for is that the port ANSWERS — see `PNG_HEAD`.
 */
export function fakeCanvas(overrides: Omit<Partial<CanvasHost>, 'snapshot'> = {}): CanvasHost {
  const host = canvasHostStub({ flatten: async () => PNG_HEAD, ...overrides })

  return {
    ...host,
    /**
     * NOT overridable, because the engine cannot make the two disagree: `snapshot()` IS
     * `flatten()` with a base64 pass after it. A fake that answered bytes to one and nothing to
     * the other described a state no engine reaches, and it is what let ⌘S read the whole picture
     * back off the card twice without a single case going red.
     */
    snapshot: async () => {
      const png = await host.flatten()
      return png && bytesToBase64(png)
    },
  }
}
