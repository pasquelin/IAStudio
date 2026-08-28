// SPDX-License-Identifier: MIT

import type { UiElementType, UiSize } from '@shared/domain/ui'

/**
 * What a control covers when nothing sizes it. In the core, so two renderers cannot put the same
 * slider in two places; `null` is « ask the measure ». A `Record` over the closed list, so a
 * fourteenth type does not compile until it has answered.
 */
const INTRINSIC_SIZES: Record<UiElementType, UiSize | null> = {
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
