import type { CSSProperties } from 'react'

/**
 * `app-region` is what makes a frameless window draggable, and React does not type it — hence
 * the cast, written once here rather than at every call site. A dragged surface makes every
 * control inside it unclickable, so each one has to switch back explicitly.
 */
export const DRAGGABLE: CSSProperties = { WebkitAppRegion: 'drag' } as CSSProperties
export const CLICKABLE: CSSProperties = { WebkitAppRegion: 'no-drag' } as CSSProperties
