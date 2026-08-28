// SPDX-License-Identifier: MIT

import type { UiElementType, UiSize } from '@shared/domain/ui'

/**
 * What a control covers when nothing sizes it — the length of a bar, the box of a tick.
 *
 * In the core rather than in whatever draws: two renderers picking their own numbers would put
 * the same slider in two places, and the editor snaps against boxes a renderer never computed.
 * `null` is « ask the measure » — a caption, a picture and a container are all read from what
 * they hold.
 *
 * A `Record` over the closed list, so a fourteenth type does not compile until it has answered.
 */
export const INTRINSIC_SIZES: Record<UiElementType, UiSize | null> = {
  screen: null,
  panel: null,
  stack: null,
  grid: null,
  scroll: null,
  button: null,
  text: null,
  image: null,
  spacer: { width: 0, height: 0 },
  progress: { width: 160, height: 8 },
  slider: { width: 160, height: 16 },
  input: { width: 160, height: 24 },
  checkbox: { width: 16, height: 16 },
}

export function intrinsicSizeOf(type: UiElementType): UiSize | null {
  return INTRINSIC_SIZES[type]
}
