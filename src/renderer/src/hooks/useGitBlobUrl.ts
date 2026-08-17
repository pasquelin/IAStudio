import { useEffect, useState } from 'react'
import { gitBridge } from '@/services/bridge'

/**
 * A URL for the bytes of one file at one version, or nothing where there are none to show.
 *
 * `ref` is `null` for the copy on disk, a hash for a recorded version. `null` comes back for a
 * path that version does not hold — which is the ordinary answer for the earlier side of a file
 * that has just been added — and for anything past the ceiling the main process keeps.
 *
 * The URL is revoked when it stops being the one on screen, and that is the whole reason this is
 * a hook rather than three lines in a component: a blob URL holds its bytes alive until it is
 * revoked, and a panel that made one per click while comparing takes of a project would hold
 * every take it had ever shown.
 */
export function useGitBlobUrl(path: string, ref: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    let made: string | null = null

    void gitBridge()
      ?.bytes(path, ref)
      // A refusal reads as "no bytes to show", which is the screen this already has for a version
      // that does not hold the path. Unhandled, it was an uncaught rejection in a console nobody
      // has open — and that is how a boundary refusing `HEAD` outright went unnoticed.
      .catch(() => null)
      .then(bytes => {
        // Unmounted, or asked for something else since: the bytes are dropped rather than turned
        // into a URL nobody will revoke.
        if (!live || !bytes) return

        // `slice()` because a `Uint8Array` may sit on a shared buffer, which `Blob` refuses —
        // the texture exporter reaches the same copy for the same reason.
        made = URL.createObjectURL(new Blob([bytes.slice()]))
        setUrl(made)
      })

    return () => {
      live = false
      if (made) URL.revokeObjectURL(made)
      setUrl(null)
    }
  }, [path, ref])

  return url
}
