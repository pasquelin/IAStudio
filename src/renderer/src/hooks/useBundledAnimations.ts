import { useEffect, useState } from 'react'
import type { BundledAnimation } from '@shared/domain/animationLibrary'
import { getBridge } from '@/services/bridge'

/** Frozen, for the same reason as `NO_ASSETS`: a fresh `[]` per render is a fresh identity. */
const NO_ANIMATIONS: readonly BundledAnimation[] = []

/**
 * The animations the app ships with — folders inside the build, so nothing invalidates them and
 * the read never repeats for a mounted surface. It DOES repeat per mount, and the picker's library
 * tab is unmounted on every visit to its neighbours: a module-level promise would answer that.
 */
export function useBundledAnimations(): readonly BundledAnimation[] {
  const [bundled, setBundled] = useState(NO_ANIMATIONS)

  useEffect(() => {
    let alive = true
    void getBridge()
      ?.animations.list()
      .then(found => {
        if (alive) setBundled(found)
      })
    return () => void (alive = false)
  }, [])

  return bundled
}
