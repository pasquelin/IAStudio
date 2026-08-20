import { useEffect, useMemo, useRef, useState } from 'react'
import type { Settings } from '@shared/domain/settings'
import { useSettings } from '@/stores/settings'

export type ViewportSetting = {
  view: Settings['three']
  /** Writes a few leaves at once. A patch, so a preset that sets three of them is one write. */
  set: (patch: Partial<Settings['three']>) => void
}

/**
 * How long a value may sit before it reaches the file. Long enough that a drag lands once, short
 * enough that letting go feels like it saved.
 */
const SETTLE_MS = 200

/** What is waiting to be written, and the settings it was measured against. */
type Pending = { patch: Partial<Settings['three']>; against: Settings['three'] }

/**
 * The 3D viewport's own preferences, read and written. Held back for a moment, with every reader
 * seeing the pending value meanwhile: a preference crosses IPC into a synchronous `writeFileSync`
 * broadcast to every window, and this panel puts sliders on that path.
 */
export function useViewportSetting(): ViewportSetting {
  const stored = useSettings(state => state.settings.three)
  const [pending, setPending] = useState<Pending | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** What the timer would have written. Read by the unmount, which has no render left to read. */
  const unwritten = useRef<Partial<Settings['three']> | null>(null)

  // FLUSHED rather than dropped: switching document or closing the panel inside the delay is an
  // ordinary thing to do, and a setting that vanished for it would be a toggle that lies.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
      if (unwritten.current) void useSettings.getState().write({ three: unwritten.current })
    },
    [],
  )

  // Dropped by comparison rather than by an effect: once the store carries something other than
  // what the patch was measured against, the answer is the store's — including a preference
  // another window has changed since.
  const held = pending?.against === stored ? pending.patch : null

  return useMemo(
    () => ({
      view: { ...stored, ...held },
      set: patch => {
        const wanted = { ...held, ...patch }
        setPending({ patch: wanted, against: stored })
        unwritten.current = wanted
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => {
          timer.current = null
          unwritten.current = null
          void useSettings.getState().write({ three: wanted })
        }, SETTLE_MS)
      },
    }),
    [stored, held],
  )
}
