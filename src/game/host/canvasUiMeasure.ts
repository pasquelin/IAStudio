// SPDX-License-Identifier: MIT

import type { UiElement, UiSize, UiText } from '@shared/domain/ui'
import { intrinsicSizeOf } from '../ui/uiIntrinsic'
import type { UiMeasure } from '../ui/uiLayout'

/**
 * The one thing a layout cannot answer on its own: how wide a word is. A `Pick` rather than the
 * context itself, so a suite hands over eleven lines instead of a browser.
 */
export type UiTextRuler = Pick<CanvasRenderingContext2D, 'font' | 'measureText'>

/** How large a picture is, natural size, or nothing while it is still loading. */
export type UiImageSizes = (assetId: string) => UiSize | null

/**
 * The gap between two baselines, as a multiple of the size. Here and in whatever draws — a
 * renderer setting its own would put a two-line caption somewhere the layout never said.
 */
export const UI_LINE_HEIGHT = 1.25

export function createCanvasUiMeasure(ruler: UiTextRuler, imageSizeOf: UiImageSizes): UiMeasure {
  // 🛑 Nothing is cached ACROSS solves: `document.fonts` is global, so an embedded face landing
  // for another document changes what this ruler answers. `layoutOf` memoises within one solve.
  let posed = ''

  return (element: UiElement, available: UiSize): UiSize => {
    const intrinsic = intrinsicSizeOf(element.type)
    if (intrinsic) return intrinsic

    if (element.type === 'image') {
      // Zero rather than a guessed box: a picture still loading that claimed 200 square would
      // shove its neighbours aside and shove them back a frame later.
      return imageSizeOf(element.image.assetId) ?? { width: 0, height: 0 }
    }
    if (element.type === 'text' || element.type === 'button') {
      const font = cssFontOf(element.text)
      // Posed only where the face changed: 450 captions of one font wrote it 900 times, and each
      // write has the engine reparse a CSS shorthand.
      if (posed !== font) {
        ruler.font = font
        posed = font
      }
      return textSize(ruler, element.text, available)
    }

    // A container holding nothing covers nothing — the solver asks for a leaf's size here.
    return { width: 0, height: 0 }
  }
}

/** `weight size family`, the shorthand a 2D context parses — and the same one the DOM is given. */
export function cssFontOf(text: UiText): string {
  return `${text.weight} ${text.size}px "${text.font.family}"`
}

/** The face is posed by the caller, which is what keeps one font from being written per call. */
function textSize(ruler: UiTextRuler, text: UiText, available: UiSize): UiSize {
  const lines = linesOf(ruler, text, available.width)
  const width = lines.reduce((widest, line) => Math.max(widest, ruler.measureText(line).width), 0)

  return { width, height: lines.length * text.size * UI_LINE_HEIGHT }
}

/**
 * Wrapped on the room offered, and never below one line: an empty caption still holds a line's
 * height, which is what stops a field's label from collapsing the row it sits on.
 */
function linesOf(ruler: UiTextRuler, text: UiText, room: number): readonly string[] {
  const written = text.value.split('\n')
  if (!text.wrap || room <= 0) return written

  return written.flatMap(line => spilled(ruler, line, room))
}

function spilled(ruler: UiTextRuler, line: string, room: number): readonly string[] {
  const words = line.split(' ')
  const lines: string[] = []
  let held = ''

  for (const word of words) {
    const tried = held === '' ? word : `${held} ${word}`
    // A single word wider than the room stays on its own line rather than being cut: breaking
    // inside one needs the shaping a ruler does not do.
    if (held !== '' && ruler.measureText(tried).width > room) {
      lines.push(held)
      held = word
    } else {
      held = tried
    }
  }

  lines.push(held)
  return lines
}
