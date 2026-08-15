import { describe, expect, it } from 'vitest'
import { isTyping } from './typing'

describe('whether a keystroke belongs to a field', () => {
  // `<select>` is the one the drifted copies disagreed on, so it is the one that matters: a
  // definition that forgets it steals the arrow keys from every open dropdown.
  it.each(['input', 'textarea', 'select'])('says yes on a <%s>', tag => {
    expect(isTyping(document.createElement(tag))).toBe(true)
  })

  // Defined rather than set: jsdom never computes `isContentEditable`, so it reads `undefined`.
  it('says yes on anything made editable, whatever its tag', () => {
    const div = document.createElement('div')
    Object.defineProperty(div, 'isContentEditable', { value: true })

    expect(isTyping(div)).toBe(true)
  })

  it('says no on an element that holds no caret', () => {
    expect(isTyping(document.createElement('button'))).toBe(false)
  })

  // The listeners that ask this are on `window`, which delivers events from anywhere — including
  // targets that are not elements at all.
  it.each([
    ['nothing at all', null],
    ['the window itself', window],
    ['the document', document],
  ])('says no on %s', (_name, target) => {
    expect(isTyping(target)).toBe(false)
  })
})
