// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest'
import { DEFAULT_TEXT, type UiElement, type UiSize } from '@shared/domain/ui'
import { newUiElement } from '@shared/domain/uiDocument'
import { uiImage, uiPanel, uiText } from '../ui/ui-fixtures'
import { createCanvasUiMeasure, cssFontOf, type UiTextRuler } from './canvasUiMeasure'

/** Ten pixels a character, so a width in the assertions reads as a count of letters. */
function ruler(): UiTextRuler {
  // `as`: `TextMetrics` declares a dozen baselines this measure never reads, and building them
  // would say less about what is asserted here than the one number that is.
  return { font: '', measureText: (text: string) => ({ width: text.length * 10 }) as TextMetrics }
}

const ROOM: UiSize = { width: 100, height: 100 }

describe('measuring what a layout cannot work out alone', () => {
  it('measures a caption at the face it is set in', () => {
    const measure = createCanvasUiMeasure(ruler(), () => null)

    expect(measure(uiText('t', 'abcd'), ROOM)).toEqual({ width: 40, height: 16 * 1.25 })
  })

  it('sets the ruler to the face before reading it', () => {
    const held = ruler()
    createCanvasUiMeasure(held, () => null)(uiText('t', 'a'), ROOM)

    expect(held.font).toBe(cssFontOf(DEFAULT_TEXT))
  })

  it('spills a caption over as many lines as the room asks for', () => {
    const measure = createCanvasUiMeasure(ruler(), () => null)

    // Three words of four letters: two fit in a hundred pixels, the third goes below.
    expect(measure(uiText('t', 'abcd efgh ijkl'), ROOM).height).toBe(2 * 16 * 1.25)
  })

  it('keeps a caption on one line when it is not to be wrapped', () => {
    const unwrapped: UiElement = {
      ...newUiElement('text', () => 't'),
      text: { ...DEFAULT_TEXT, value: 'abcd efgh ijkl', wrap: false },
    }

    expect(createCanvasUiMeasure(ruler(), () => null)(unwrapped, ROOM)).toEqual({
      width: 140,
      height: 16 * 1.25,
    })
  })

  it('breaks a caption on the newlines it was written with', () => {
    const measure = createCanvasUiMeasure(ruler(), () => null)

    expect(measure(uiText('t', 'ab\ncd'), ROOM).height).toBe(2 * 16 * 1.25)
  })

  it('gives a control the box the core says it covers', () => {
    const measure = createCanvasUiMeasure(ruler(), () => null)

    expect(
      measure(
        newUiElement('checkbox', () => 'c'),
        ROOM,
      ),
    ).toEqual({ width: 16, height: 16 })
  })

  /** Nothing rather than a guess: a picture claiming a box would shove its neighbours twice. */
  it('gives a picture its natural size, and nothing at all while it is loading', () => {
    const known = createCanvasUiMeasure(ruler(), () => ({ width: 32, height: 48 }))

    expect(known(uiImage('picture', 'asset_1'), ROOM)).toEqual({ width: 32, height: 48 })
    expect(createCanvasUiMeasure(ruler(), () => null)(uiImage('picture', 'asset_1'), ROOM)).toEqual(
      {
        width: 0,
        height: 0,
      },
    )
  })

  it('gives an empty container nothing to cover', () => {
    expect(createCanvasUiMeasure(ruler(), () => null)(uiPanel('p'), ROOM)).toEqual({
      width: 0,
      height: 0,
    })
  })
})
