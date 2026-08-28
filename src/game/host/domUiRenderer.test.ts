// SPDX-License-Identifier: MIT

import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_STYLE, type UiBox, type UiBoxes, type UiScreen } from '@shared/domain/ui'
import type { AssetPort } from '../ports/assetPort'
import type { UiFrame, UiValues } from '../ports/uiRenderPort'
import { uiDocumentOf, uiImage, uiPanel, uiProgress, uiScreen, uiText } from '../ui/ui-fixtures'
import { createDomUiRenderer } from './domUiRenderer'

const BOXES: readonly [string, UiBox][] = [
  ['root', { x: 0, y: 0, width: 100, height: 100 }],
  ['a', { x: 5, y: 6, width: 30, height: 40 }],
  ['b', { x: 50, y: 0, width: 30, height: 40 }],
]

const NO_ASSETS: AssetPort = { urlOf: () => null }

const framed = (
  root: UiScreen,
  over: Partial<Pick<UiFrame, 'ui' | 'order' | 'values' | 'boxes'>> = {},
): UiFrame => ({
  ui: 'hud',
  document: uiDocumentOf(root),
  boxes: new Map(BOXES),
  values: new Map(),
  order: 0,
  ...over,
})

let host: HTMLElement

const rootOf = (): HTMLElement => {
  const found = host.firstElementChild
  if (!(found instanceof HTMLElement)) throw new Error('the renderer laid down no overlay')
  return found
}

const drawn = (): HTMLElement[] => [...rootOf().children].filter(one => one instanceof HTMLElement)

const idsDrawn = (): (string | undefined)[] => drawn().map(node => node.dataset.uiElement)

beforeEach(() => {
  document.body.replaceChildren()
  host = document.createElement('div')
  document.body.appendChild(host)
})

describe('an interface drawn as DOM', () => {
  it('poses one node per element, at the box it was handed', () => {
    const renderer = createDomUiRenderer({ host, assets: NO_ASSETS })
    renderer.draw([framed(uiScreen([uiPanel('a')]))])

    const node = drawn()[1]
    expect(idsDrawn()).toEqual(['root', 'a'])
    expect(node?.style.left).toBe('5px')
    expect(node?.style.top).toBe('6px')
    expect(node?.style.width).toBe('30px')
    expect(node?.style.height).toBe('40px')
  })

  /** Flat, so the paint order IS the document order: a child after its parent, a sibling after. */
  it('paints a child over its parent and a later sibling over an earlier one', () => {
    const renderer = createDomUiRenderer({ host, assets: NO_ASSETS })
    renderer.draw([framed(uiScreen([uiPanel('a', [uiText('b')])]))])

    expect(idsDrawn()).toEqual(['root', 'a', 'b'])
  })

  /** `order` says the pile, never the order the frames were handed over in. */
  it('paints the interface highest in the pile last', () => {
    const renderer = createDomUiRenderer({ host, assets: NO_ASSETS })
    renderer.draw([
      framed(uiScreen([]), { ui: 'menu', order: 9 }),
      framed(uiScreen([]), { ui: 'hud', order: 1 }),
    ])

    expect(drawn().map(node => node.dataset.ui)).toEqual(['hud', 'menu'])
  })

  /** These writes land on every frame of a drag: the node has to survive them. */
  it('mutates the node it already has rather than replacing it', () => {
    const renderer = createDomUiRenderer({ host, assets: NO_ASSETS })
    renderer.draw([framed(uiScreen([uiPanel('a')]))])
    const first = drawn()[1]

    const moved: UiBoxes = new Map([...BOXES, ['a', { x: 11, y: 6, width: 30, height: 40 }]])
    renderer.draw([framed(uiScreen([uiPanel('a')]), { boxes: moved })])

    expect(drawn()[1]).toBe(first)
    expect(first?.style.left).toBe('11px')
  })

  it('takes away what the document no longer holds', () => {
    const renderer = createDomUiRenderer({ host, assets: NO_ASSETS })
    renderer.draw([framed(uiScreen([uiPanel('a'), uiPanel('b')]))])
    renderer.draw([framed(uiScreen([uiPanel('b')]))])

    expect(idsDrawn()).toEqual(['root', 'b'])
  })

  it('draws nothing of an invisible element, nor of what it holds', () => {
    const hidden = uiScreen([{ ...uiPanel('a', [uiText('b')]), visible: false }])
    const renderer = createDomUiRenderer({ host, assets: NO_ASSETS })
    renderer.draw([framed(hidden)])

    expect(idsDrawn()).toEqual(['root'])
  })

  /** What nesting would have given for free, and the reason the overlay may stay flat. */
  it('multiplies opacity down the tree', () => {
    const faded = uiScreen([
      {
        ...uiPanel('a', [uiText('b')]),
        style: { ...DEFAULT_STYLE, opacity: 0.5 },
      },
    ])
    const renderer = createDomUiRenderer({ host, assets: NO_ASSETS })
    renderer.draw([framed(faded)])

    expect(drawn()[1]?.style.opacity).toBe('0.5')
    expect(drawn()[2]?.style.opacity).toBe('0.5')
  })

  it('writes the caption a document holds, and the one a running interface overrides it with', () => {
    const renderer = createDomUiRenderer({ host, assets: NO_ASSETS })
    renderer.draw([framed(uiScreen([uiText('a', 'Score')]))])
    expect(drawn()[1]?.textContent).toBe('Score')

    const live: UiValues = new Map([['a', '120']])
    renderer.draw([framed(uiScreen([uiText('a', 'Score')]), { values: live })])
    expect(drawn()[1]?.textContent).toBe('120')
  })

  it('fills a bar to the share its value stands at', () => {
    const renderer = createDomUiRenderer({ host, assets: NO_ASSETS })
    renderer.draw([framed(uiScreen([uiProgress('a', 0.25)]))])

    expect(drawn()[1]?.firstElementChild).toBeInstanceOf(HTMLElement)
    expect(drawn()[1]?.querySelector('div')?.style.width).toBe('25%')
  })

  it('serves a picture from the host that holds the bytes', () => {
    const assets: AssetPort = { urlOf: ref => (ref.kind === 'asset' ? `./a/${ref.id}.png` : null) }
    const renderer = createDomUiRenderer({ host, assets })
    renderer.draw([framed(uiScreen([uiImage('a', 'x1', 'cover')]))])

    expect(drawn()[1]?.style.backgroundImage).toContain('./a/x1.png')
    expect(drawn()[1]?.style.backgroundSize).toBe('cover')
  })

  /** 🛑 Answered from the boxes, which is what a world-space renderer will hand a point in. */
  it('answers a pick from the boxes rather than from the tree it drew', () => {
    const renderer = createDomUiRenderer({ host, assets: NO_ASSETS })
    renderer.draw([framed(uiScreen([uiPanel('a')]))])

    expect(renderer.pick({ x: 10, y: 10 })).toEqual({ ui: 'hud', element: 'a' })
    expect(renderer.pick({ x: 90, y: 90 })).toEqual({ ui: 'hud', element: 'root' })
  })

  it('lets its host ask for a locked element to be skipped', () => {
    const locked = uiScreen([{ ...uiPanel('a'), locked: true }])
    const renderer = createDomUiRenderer({ host, assets: NO_ASSETS, picking: { skipLocked: true } })
    renderer.draw([framed(locked)])

    expect(renderer.pick({ x: 10, y: 10 })?.element).toBe('root')
  })

  /** The overlay is not what reads a gesture: the host does, and answers through `pick`. */
  it('takes no pointer of its own', () => {
    createDomUiRenderer({ host, assets: NO_ASSETS })

    expect(rootOf().style.pointerEvents).toBe('none')
  })

  it('takes the size it is given', () => {
    const renderer = createDomUiRenderer({ host, assets: NO_ASSETS })
    renderer.resize({ width: 640, height: 360 })

    expect(rootOf().style.width).toBe('640px')
    expect(rootOf().style.height).toBe('360px')
  })

  it('leaves its host as it found it', () => {
    const renderer = createDomUiRenderer({ host, assets: NO_ASSETS })
    renderer.draw([framed(uiScreen([uiPanel('a')]))])
    renderer.dispose()

    expect(host.children.length).toBe(0)
  })
})
