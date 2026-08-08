import { mdiLockOpenVariantOutline, mdiLockOutline } from '@mdi/js'
import type { LayerLocks } from '@/engines/canvas/canvas-state'

/**
 * The three padlocks, declared once for the stack row and the inspector — the same reason
 * `TRACK_FLAGS` is declared once for the track headers and theirs: two hand-written copies had
 * already drifted into two different controls.
 */
export const LAYER_LOCKS: readonly {
  key: keyof LayerLocks
  labelKey: string
  iconFor: (locked: boolean) => string
}[] = [
  { key: 'pixels', labelKey: 'inspector.lock_pixels', iconFor: padlockIcon },
  { key: 'position', labelKey: 'inspector.lock_position', iconFor: padlockIcon },
  { key: 'alpha', labelKey: 'inspector.lock_alpha', iconFor: padlockIcon },
]

function padlockIcon(locked: boolean): string {
  return locked ? mdiLockOutline : mdiLockOpenVariantOutline
}
