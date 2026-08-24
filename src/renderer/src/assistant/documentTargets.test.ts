import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_CANVAS, pixelLayer } from '@/engines/canvas/canvasState'
import { installIn } from '@/stores/document-fixtures'
import { canvasOf, canvasStore, useCanvases } from '@/stores/canvases'
import { aimAt, frontTargets } from './documentTargets'

const DOCUMENT = 'doc-image'

beforeEach(() => {
  installIn(
    canvasStore,
    DOCUMENT,
    { ...DEFAULT_CANVAS, layers: [pixelLayer('back', 'Sky'), pixelLayer('front', 'Boat')] },
    'image',
  )
})

describe('what the document in front can be aimed at', () => {
  /** Topmost first: the order the stack panel shows, not the order the compositor paints. */
  it('lists an image by its layers, the top of the stack first', () => {
    expect(frontTargets()?.targets()).toEqual([
      { id: 'front', kind: 'layer', name: 'Boat', selected: false },
      { id: 'back', kind: 'layer', name: 'Sky', selected: false },
    ])
  })

  it('arms the layer aimed at, so the rest of the studio sees the pick', () => {
    expect(aimAt('back')).toEqual({ ok: true })
    expect(canvasOf(useCanvases.getState(), DOCUMENT).activeLayerId).toBe('back')
  })

  it('refuses an id the document does not hold', () => {
    expect(aimAt('gone')).toEqual({ ok: false, refusal: 'notFound' })
  })
})
