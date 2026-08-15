import { afterEach, describe, expect, it } from 'vitest'
import { scrollParentOf } from './scroll-parent'

function tree(...overflows: (string | undefined)[]): HTMLElement {
  let parent = document.body

  for (const overflow of overflows) {
    const element = document.createElement('div')
    if (overflow !== undefined) element.style.overflowY = overflow
    parent.append(element)
    parent = element
  }

  const leaf = document.createElement('div')
  parent.append(leaf)
  return leaf
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('finding what scrolls an element', () => {
  it('answers the nearest ancestor that scrolls', () => {
    const leaf = tree('auto', undefined)
    expect(scrollParentOf(leaf)).toBe(document.body.firstElementChild)
  })

  it('takes the nearest one when two of them scroll', () => {
    const leaf = tree('auto', 'scroll')
    expect(scrollParentOf(leaf)).toBe(leaf.parentElement)
  })

  it('counts scroll as well as auto', () => {
    expect(scrollParentOf(tree('scroll'))?.style.overflowY).toBe('scroll')
  })

  it('does not take one that only clips', () => {
    // `hidden` has a scrollHeight like any other box and scrolls for nobody.
    expect(scrollParentOf(tree('hidden'))).toBeNull()
  })

  it('answers nothing when nothing above scrolls', () => {
    expect(scrollParentOf(tree(undefined, undefined))).toBeNull()
  })

  it('answers nothing for an element that is not there yet', () => {
    // A ref read before its first render is null, and the grid asks on mount.
    expect(scrollParentOf(null)).toBeNull()
  })
})
