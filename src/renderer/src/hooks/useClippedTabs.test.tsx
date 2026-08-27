import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useClippedTabs } from './useClippedTabs'

const ROOM = 100
const TAB = 30

const ids = new Map<Element, string>()

/** A strip with room for `ROOM`, holding tabs of `TAB` laid end to end from `offset`. */
function strip(count: number, offset = 0): HTMLElement {
  ids.clear()
  const element = document.createElement('div')
  element.getBoundingClientRect = () => new DOMRect(0, 0, ROOM, 0)

  for (let index = 0; index < count; index += 1) add(element, index, offset)

  return element
}

function add(element: HTMLElement, index: number, offset: number): void {
  const tab = document.createElement('div')
  const left = offset + index * TAB
  tab.getBoundingClientRect = () => new DOMRect(left, 0, TAB, 0)
  ids.set(tab, `doc-${index + 1}`)
  element.append(tab)
}

const clipped = (element: HTMLElement) =>
  renderHook(() => useClippedTabs(element, tab => ids.get(tab)))

describe('useClippedTabs', () => {
  it('reports nothing while every tab is whole', () => {
    expect(clipped(strip(3)).result.current).toEqual([])
  })

  it('reports a tab the strip has cut, whole or half', () => {
    // Three fit exactly; the fourth starts inside and ends past the edge.
    expect(clipped(strip(5)).result.current).toEqual(['doc-4', 'doc-5'])
  })

  // The strip scrolls, so a tab can leave by the left as well — one asked for by name, and the
  // one the pointer is on, are on opposite sides of the same measurement.
  it('reports a tab that has scrolled off the left', () => {
    expect(clipped(strip(3, -TAB)).result.current).toEqual(['doc-1'])
  })

  it('measures again when a tab is opened', async () => {
    const element = strip(3)
    const { result } = clipped(element)
    expect(result.current).toEqual([])

    add(element, 3, 0)

    await waitFor(() => expect(result.current).toEqual(['doc-4']))
  })
})
