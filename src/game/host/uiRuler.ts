// SPDX-License-Identifier: MIT

import type { UiTextRuler } from './canvasUiMeasure'

/** A ruler, and whether what it answers was MEASURED or estimated. */
export type UiRuler = UiTextRuler & { exact: boolean }

/**
 * How wide a word is, for the layout solver: a 2D context where the host has one, a named
 * approximation where it has not. Beside the inert ports rather than in the editor — « no 2D
 * context » is a property of the HOST, and a headless render of an exported game asks it too.
 *
 * 🛑 It answers ROUGHLY rather than refusing, unlike `createInertUiRender` next door, and the
 * two differ on purpose: a pick with no surface has no honest answer, where a caption laid a
 * little off still reads. `exact` is what lets a caller that must not snap to invented numbers
 * tell the two apart.
 */
export function createUiRuler(owner: Document): UiRuler {
  const context = owner.createElement('canvas').getContext('2d')
  if (!context) return approximateRuler()

  return {
    exact: true,
    get font(): string {
      return context.font
    },
    set font(value: string) {
      context.font = value
    },
    measureText: (text: string) => context.measureText(text),
  }
}

/** Half an em a character, which is about where a proportional face averages out. */
const AVERAGE_ADVANCE = 0.5

function approximateRuler(): UiRuler {
  let size = 16

  return {
    exact: false,
    get font(): string {
      return `${size}px`
    },
    set font(value: string) {
      size = Number.parseFloat(/(\d+(?:\.\d+)?)px/.exec(value)?.[1] ?? '16')
    },
    // `as`: `TextMetrics` declares a dozen baselines a layout never asks for.
    measureText: (text: string) => ({ width: text.length * size * AVERAGE_ADVANCE }) as TextMetrics,
  }
}
