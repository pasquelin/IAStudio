// SPDX-License-Identifier: MIT

import { beforeEach, describe, expect, it } from 'vitest'
import { uiFromPayload } from '@shared/domain/uiDocument'
import type { AssetPort } from '../ports/assetPort'
import { layoutOf } from '../ui/uiLayout'
import { createCanvasUiMeasure, type UiTextRuler } from './canvasUiMeasure'
import { createDomUiRenderer } from './domUiRenderer'

/**
 * 🛑 That an exported game needs no second system to show an interface — proven here, in the lot
 * that first can, rather than discovered at the end of the chantier.
 *
 * The whole chain and nothing else: the JSON a `.ui.json` holds, read by the shared reader, laid
 * out by the pure solver, posed by the DOM renderer into a page. No studio, no React, no store,
 * no stylesheet — the day an import of convenience breaks that, this is what turns red.
 *
 * The ruler is a stand-in and that is the ONE thing this cannot prove: jsdom implements no 2D
 * context, so what a browser answers for a caption's width is measured by hand, in the app.
 */
const RULER: UiTextRuler = {
  font: '',
  // `as`: `TextMetrics` declares a dozen baselines this measure never reads.
  measureText: (text: string) => ({ width: text.length * 10 }) as TextMetrics,
}

const ASSETS: AssetPort = { urlOf: ref => (ref.kind === 'asset' ? `./assets/${ref.id}` : null) }

/** What a `.ui.json` holds once its envelope is off — a HUD with a caption and a bar. */
const FILE: Record<string, unknown> = {
  version: 1,
  mode: 'screen',
  design: { width: 1920, height: 1080 },
  root: {
    id: 'root',
    type: 'screen',
    name: 'Screen',
    children: [
      {
        id: 'label',
        type: 'text',
        name: 'Label',
        text: { value: 'Score', size: 16 },
        place: { anchor: 'topLeft', offset: { x: 12, y: 8 } },
      },
      {
        id: 'health',
        type: 'progress',
        name: 'Health',
        progress: { value: 0.5, min: 0, max: 1 },
        place: { anchor: 'bottomLeft', pivot: 'bottomLeft', offset: { x: 12, y: 8 } },
      },
    ],
  },
}

let host: HTMLElement

beforeEach(() => {
  document.body.replaceChildren()
  host = document.createElement('div')
  document.body.appendChild(host)
})

describe('the path an exported game takes to show an interface', () => {
  it('reads a file, lays it out and poses it in a page, with no studio anywhere', () => {
    const { document: read, trouble } = uiFromPayload(FILE, () => 'unused')
    expect(trouble).toBeNull()

    const viewport = { width: 640, height: 360 }
    const boxes = layoutOf(
      read.root,
      viewport,
      createCanvasUiMeasure(RULER, () => null),
    )

    const renderer = createDomUiRenderer({ host, assets: ASSETS })
    renderer.resize(viewport)
    renderer.draw([{ ui: 'hud', document: read, boxes, values: new Map(), order: 0 }])

    const nodes = [...host.querySelectorAll('[data-ui-element]')]
    expect(nodes.map(node => node.getAttribute('data-ui-element'))).toEqual([
      'root',
      'label',
      'health',
    ])

    // Posed at the box the solver gave, and at no box the browser was asked for.
    const label = host.querySelector<HTMLElement>('[data-ui-element="label"]')
    expect(label?.textContent).toBe('Score')
    expect(label?.style.left).toBe(`${boxes.get('label')?.x}px`)
    expect(label?.style.top).toBe(`${boxes.get('label')?.y}px`)

    // Anchored bottom-left, so it moves with the viewport rather than with the design size.
    expect(boxes.get('health')?.y).toBeGreaterThan(viewport.height / 2)

    renderer.dispose()
    expect(host.children.length).toBe(0)
  })

  /** A file from a later build is refused whole rather than opened half — and says which. */
  it('says why a file it cannot use did not open', () => {
    expect(uiFromPayload({ ...FILE, version: 99 }, () => 'x').trouble).toBe('too-new')
    expect(uiFromPayload('not an interface', () => 'x').trouble).toBe('unreadable')
  })
})
