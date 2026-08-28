import type { UiSize } from './ui'

/**
 * The canvases an interface is drawn at. A REFERENCE and never a factor: the layout is solved
 * against whatever viewport it is handed and the anchors absorb the difference, so changing one
 * of these moves the editor's page, not what the document means.
 *
 * `free` is the one with no size of its own — the document keeps whatever it was given, which is
 * what a hand-edited file or a resolution nobody thought of needs.
 */
export type UiResolutionId =
  'desktopHd' | 'desktop720' | 'phonePortrait' | 'phoneLandscape' | 'free'

export const UI_RESOLUTION_IDS: readonly UiResolutionId[] = [
  'desktopHd',
  'desktop720',
  'phonePortrait',
  'phoneLandscape',
  'free',
]

/** A `Record`, so a sixth preset does not compile until it has said what it measures. */
export const UI_RESOLUTIONS: Record<UiResolutionId, UiSize | null> = {
  desktopHd: { width: 1920, height: 1080 },
  desktop720: { width: 1280, height: 720 },
  phonePortrait: { width: 390, height: 844 },
  phoneLandscape: { width: 844, height: 390 },
  free: null,
}

/** Which preset a document's canvas IS, or `free` for a size none of them names. */
export function uiResolutionOf(design: UiSize): UiResolutionId {
  return (
    UI_RESOLUTION_IDS.find(id => {
      const size = UI_RESOLUTIONS[id]
      return size !== null && size.width === design.width && size.height === design.height
    }) ?? 'free'
  )
}

export function isUiResolutionId(value: unknown): value is UiResolutionId {
  return UI_RESOLUTION_IDS.some(id => id === value)
}
