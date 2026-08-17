import type { SerializedDockview } from 'dockview-react'

/**
 * Serialized Dockview layout, whose shape belongs to Dockview.
 *
 * On its own rather than beside the store that persists it: `layout-prune` needs the type and the
 * store needs `layout-prune`, which is a cycle even when one half of it is spelt `import type`.
 */
export type SerializedLayout = SerializedDockview
