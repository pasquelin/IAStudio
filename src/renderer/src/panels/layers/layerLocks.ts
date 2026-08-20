import { mdiLockOpenVariantOutline, mdiLockOutline } from '@mdi/js'
import { LOCK_KEYS, type LayerLocks } from '@/engines/canvas/canvasState'

/**
 * The three padlocks as the SCREEN wears them — their order and their keys come from the state,
 * which `layer.lock` reads too; what is added here is the label and the glyph.
 */
export const LAYER_LOCKS: readonly {
  key: keyof LayerLocks
  labelKey: string
  iconFor: (locked: boolean) => string
}[] = LOCK_KEYS.map(key => ({ key, labelKey: `inspector.lock_${key}`, iconFor: padlockIcon }))

function padlockIcon(locked: boolean): string {
  return locked ? mdiLockOutline : mdiLockOpenVariantOutline
}
