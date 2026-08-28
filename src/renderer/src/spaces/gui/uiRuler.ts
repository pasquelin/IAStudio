import type { UiTextRuler } from '@game/host/canvasUiMeasure'

/**
 * How wide a word is, for the layout solver. A 2D context where there is one, and a NAMED
 * approximation where there is not — a canvas refuses a context under a suite, and an editor
 * that laid every caption at zero would be worse than one that laid them roughly.
 *
 * The fallback is written rather than hidden: what it gets wrong is caption widths, and only
 * where no browser is drawing anyway.
 */
export function createUiRuler(): UiTextRuler {
  const context = document.createElement('canvas').getContext('2d')
  return context ?? approximateRuler()
}

/** Half an em a character, which is about where a proportional face averages out. */
const AVERAGE_ADVANCE = 0.5

function approximateRuler(): UiTextRuler {
  let size = 16

  return {
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
