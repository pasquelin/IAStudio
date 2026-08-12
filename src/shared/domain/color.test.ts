import { describe, expect, it } from 'vitest'
import {
  AA_NORMAL_TEXT,
  blend,
  contrastRatio,
  HEX_COLOR,
  contentFor,
  hoverFor,
  inkFor,
  readColor,
  relativeLuminance,
} from './color'

describe('readColor', () => {
  it('reads a hexadecimal colour, in either case', () => {
    expect(readColor({ color: '#ffcc88' }, 'color', '#000000')).toBe('#ffcc88')
    expect(readColor({ color: '#FFCC88' }, 'color', '#000000')).toBe('#FFCC88')
  })

  /*
   * All four render, and Chromium normalises all four in the swatch — measured, and it is why
   * this is a consistency rule rather than a rescue. Refused so that the file, the control and
   * the render carry one spelling: `red` in state against `#ff0000` in the control is one colour
   * under two strings, and nothing downstream compares them as colours.
   */
  it('refuses a colour written in another notation', () => {
    expect(readColor({ color: '#fff' }, 'color', '#ffffff')).toBe('#ffffff')
    expect(readColor({ color: 'red' }, 'color', '#ffffff')).toBe('#ffffff')
    expect(readColor({ color: 'rgb(255,0,0)' }, 'color', '#ffffff')).toBe('#ffffff')
    expect(readColor({ color: 'hsl(0,100%,50%)' }, 'color', '#ffffff')).toBe('#ffffff')
  })

  // The class three.js refuses outright: `Color.set` logs and leaves the material at whatever
  // colour it already had, which is the one case with nothing on screen to report it.
  it('refuses a string that is no colour to anyone', () => {
    expect(readColor({ color: 'banana' }, 'color', '#ffffff')).toBe('#ffffff')
    expect(readColor({ color: 'ffffff' }, 'color', '#ffffff')).toBe('#ffffff')
    expect(readColor({ color: '#ff00' }, 'color', '#ffffff')).toBe('#ffffff')
    expect(readColor({ color: '#ff000000' }, 'color', '#ffffff')).toBe('#ffffff')
  })

  // No `g` flag: `lastIndex` would run past a seven-character string and the second call would
  // answer the fallback. Shared by three readers, so it is asked twice in the same frame.
  it('answers the same on a second call', () => {
    expect(readColor({ color: '#123456' }, 'color', '#000000')).toBe('#123456')
    expect(readColor({ color: '#123456' }, 'color', '#000000')).toBe('#123456')
  })

  it('falls back on a value of another type, or on none at all', () => {
    expect(readColor({ color: 2 }, 'color', '#ffffff')).toBe('#ffffff')
    expect(readColor({ color: null }, 'color', '#ffffff')).toBe('#ffffff')
    expect(readColor({}, 'color', '#ffffff')).toBe('#ffffff')
  })
})

describe('HEX_COLOR', () => {
  /*
   * Both ends, and each end needs its own case: every string that fails the tail also fails the
   * head, so a test built on trailing rubbish alone leaves `^` free to be dropped. It was — the
   * first version of this file asserted `'#ffcc88 and more'` and `'rgb(#ffcc88)'`, and removing
   * `^` kept all 7036 tests green.
   */
  it('refuses a colour with anything BEFORE it', () => {
    expect(HEX_COLOR.test('url(#ff0000')).toBe(false)
    expect(HEX_COLOR.test(' #ff0000')).toBe(false)
    expect(HEX_COLOR.test('red#ff0000')).toBe(false)
    expect(HEX_COLOR.test('\n#ff0000')).toBe(false)
  })

  it('refuses a colour with anything AFTER it', () => {
    expect(HEX_COLOR.test('#ffcc88 and more')).toBe(false)
    expect(HEX_COLOR.test('#ffcc8899')).toBe(false)
  })

  // The shape is read by zod in the main process as well as by the readers here: a `g` would
  // widen both at once, and asymmetrically — only the second call of each pair.
  it('carries no flag but case-insensitivity', () => {
    expect(HEX_COLOR.flags).toBe('i')
  })
})

describe('the contrast of two colours', () => {
  // The two extremes WCAG itself is defined against, so a sign error cannot pass.
  it('runs from one to twenty-one', () => {
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5)
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5)
  })

  it('does not care which colour is given first', () => {
    expect(contrastRatio('#3574f0', '#2b2d30')).toBeCloseTo(contrastRatio('#2b2d30', '#3574f0'), 9)
  })

  // The measurement this studio's ink tokens were cut from, kept as the reference it was.
  it('reads the studio accent as unfit to carry a word on the chassis', () => {
    expect(contrastRatio('#3574f0', '#2b2d30')).toBeLessThan(AA_NORMAL_TEXT)
    expect(contrastRatio('#6193f3', '#2b2d30')).toBeGreaterThanOrEqual(AA_NORMAL_TEXT)
  })
})

describe('the ink of an accent', () => {
  it('lightens on a dark backdrop and darkens on a light one', () => {
    const onDark = inkFor('#3574f0', '#2b2d30')
    const onLight = inkFor('#3574f0', '#dcdde1')

    expect(relativeLuminance(onDark)).toBeGreaterThan(relativeLuminance('#3574f0'))
    expect(relativeLuminance(onLight)).toBeLessThan(relativeLuminance('#3574f0'))
  })

  it('moves exactly as far as the threshold, on either backdrop', () => {
    for (const backdrop of ['#2b2d30', '#191a1c', '#dcdde1', '#ffffff']) {
      expect(contrastRatio(inkFor('#3574f0', backdrop), backdrop)).toBeGreaterThanOrEqual(
        AA_NORMAL_TEXT,
      )
    }
  })

  it('leaves a colour that already clears it exactly as it was', () => {
    expect(inkFor('#ffffff', '#2b2d30')).toBe('#ffffff')
  })

  // A chassis read back as an empty string is what an unmounted root hands over, and a colour
  // is better than none on a screen: the caller gets its own accent rather than a broken value.
  it('gives the accent back untouched when either colour is not one', () => {
    expect(inkFor('#3574f0', '')).toBe('#3574f0')
    expect(inkFor('rebeccapurple', '#2b2d30')).toBe('rebeccapurple')
  })

  it('stays on the studio shape, so what it returns can be stored and rendered', () => {
    expect(inkFor('#12b600', '#2b2d30')).toMatch(HEX_COLOR)
    expect(inkFor('#ff715b', '#ffffff')).toMatch(HEX_COLOR)
  })
})

describe('the ink written ON a fill', () => {
  it('keeps white wherever white can be read, so a picked blue is not flipped for a tenth', () => {
    // The studio's own accent: white carries 4.61:1 there, which is what the sheet ships.
    expect(contentFor('#336fe6')).toBe('#ffffff')
    expect(contentFor('#5b21b6')).toBe('#ffffff')
  })

  it('turns black on a fill light enough to swallow white', () => {
    // Measured on colours a user can actually pick: white reads 1.71:1 on this yellow and 1.93
    // on this teal, which is a label nobody can read on the one button a surface exists for.
    expect(contentFor('#f0c035')).toBe('#000000')
    expect(contentFor('#4ecdc4')).toBe('#000000')
  })

  it('clears AA on every fill where one of the two can', () => {
    for (const fill of ['#336fe6', '#f0c035', '#4ecdc4', '#ff6b9d', '#5b21b6', '#12b600']) {
      expect(contrastRatio(contentFor(fill), fill)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT)
    }
  })

  /**
   * No colour puts BOTH under 4.5 — white fails under a luminance of 0.183 and black over 0.175,
   * so the ranges overlap. The fallback is therefore only reachable above AA, and asking for AAA
   * is how it gets exercised at all rather than sitting in the file as a line nothing can run.
   */
  it('answers the better of the two when a stricter bar leaves neither clearing it', () => {
    // At 7:1 this grey gives white 4.54 and black 4.62: neither is a rescue, and the point is
    // only that the answer is not the deliberately worse one.
    expect(contentFor('#767676', 7)).toBe('#000000')
    expect(contentFor('#767676')).toBe('#ffffff')
  })

  it('stays on white when white is the better of the two, even having failed the bar', () => {
    // The other side of the same fallback, and it is not symmetric: on this slate white reads
    // 6.92 and black 3.03, so failing a 7:1 bar is no reason to hand back the worse of the two.
    expect(contentFor('#4a5a7a', 7)).toBe('#ffffff')
  })

  it('falls back to white for something that is not a colour, rather than throwing', () => {
    expect(contentFor('')).toBe('#ffffff')
    expect(contentFor('rebeccapurple')).toBe('#ffffff')
  })
})

describe('an ink laid over a fill', () => {
  it('answers the fill itself at no opacity, and the ink at full', () => {
    expect(blend('#ffffff', '#000000', 0)).toBe('#000000')
    expect(blend('#ffffff', '#000000', 1)).toBe('#ffffff')
  })

  it('composes what a reader actually sees, which is the only thing a ratio can be taken on', () => {
    // The studio's own case, measured: `text-muted/70` on a panel is this grey, and it reads
    // 3.50:1 there — a ratio no test of this repository could see before, because `muted` alone
    // reads 5.79 and that is the number a guard on opaque tokens would have found.
    const seen = blend('#91959b', '#191a1c', 0.7)

    expect(seen).toBe('#6d7075')
    expect(contrastRatio(seen, '#191a1c')).toBeLessThan(AA_NORMAL_TEXT)
    expect(contrastRatio('#91959b', '#191a1c')).toBeGreaterThan(AA_NORMAL_TEXT)
  })

  it('stays on the studio shape, and hands back what it cannot compose', () => {
    expect(blend('#12b600', '#2b2d30', 0.5)).toMatch(HEX_COLOR)
    expect(blend('rebeccapurple', '#2b2d30', 0.5)).toBe('rebeccapurple')
    expect(blend('#12b600', '', 0.5)).toBe('#12b600')
  })
})

describe('the fill a hover takes', () => {
  /**
   * The one hover pair in this repository a human drew by eye, in both themes. Reproducing it to
   * the byte is what says the step is the studio's own and not a number picked to fit one case —
   * and it is the assertion that would fail first if the step were ever nudged.
   */
  it('redraws the green the sheet ships, in both themes', () => {
    expect(hoverFor('#12b600')).toBe('#0e9200')
    expect(hoverFor('#0b7100')).toBe('#095a00')
  })

  it('darkens the accent rather than lightening it, which is what an alpha did', () => {
    // `bg-accent/85` over the light theme's panel composed to #5284f4, and white on THAT is 3.52.
    expect(hoverFor('#346ef2')).toBe('#2a58c2')
    expect(contrastRatio('#ffffff', '#2a58c2')).toBeGreaterThan(AA_NORMAL_TEXT)
    expect(contrastRatio('#ffffff', blend('#346ef2', '#ffffff', 0.85))).toBeLessThan(AA_NORMAL_TEXT)
  })

  it('lightens instead when a fill has nowhere darker to go', () => {
    expect(hoverFor('#000000')).toBe('#333333')
  })

  it('leaves a fill alone rather than taking its ink under the bar', () => {
    // Saturated magenta: darker fails black, lighter is the same colour to a reader.
    expect(hoverFor('#ff00ff')).toBe('#ff00ff')
  })

  it('never takes the ink of a fill under the bar, over every hue', () => {
    const failing: string[] = []

    for (let red = 0; red < 256; red += 17) {
      for (let green = 0; green < 256; green += 17) {
        for (let blue = 0; blue < 256; blue += 17) {
          const fill = `#${[red, green, blue].map(one => one.toString(16).padStart(2, '0')).join('')}`
          const hover = hoverFor(fill)
          if (contrastRatio(contentFor(fill), hover) < AA_NORMAL_TEXT) failing.push(fill)
        }
      }
    }

    expect(failing).toEqual([])
  })

  it('stays on the studio shape, and hands back what it cannot move', () => {
    expect(hoverFor('#346ef2')).toMatch(HEX_COLOR)
    expect(hoverFor('rebeccapurple')).toBe('rebeccapurple')
  })
})
