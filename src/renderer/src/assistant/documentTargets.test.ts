import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_CANVAS, pixelLayer } from '@/engines/canvas/canvasState'
import { createDefaultScene } from '@/engines/scene/defaultScene'
import { createNodeOf } from '@/engines/scene/nodeFactory'
import { EMPTY_SEQUENCE, makeClip, makeTrack } from '@/engines/timeline/timelineState'
import { installIn } from '@/stores/document-fixtures'
import { canvasOf, canvasStore, useCanvases } from '@/stores/canvases'
import { installScene } from '@/stores/scene-fixtures'
import { sceneOf, useScenes } from '@/stores/scenes'
import { sequenceOf, sequenceStore, useSequences } from '@/stores/sequences'
import { aimAt, frontTargets } from './documentTargets'

const DOCUMENT = 'doc-image'
const SCENE = 'doc-scene'
const MONTAGE = 'doc-montage'

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

/**
 * 🛑 The two spaces that named NOTHING until now, and it cost eight refusals on one sentence:
 * `clip.move` takes a track id, and a briefing carrying none had the model invent `track-1`.
 */
describe('what a scene and a montage can be aimed at', () => {
  const withCube = (selectedIds: string[]): void => {
    const box = createNodeOf('box')
    installScene(SCENE, {
      ...createDefaultScene(),
      nodes: box ? [{ ...box, id: 'cube', name: 'Cube Test' }] : [],
      selectedIds,
    })
  }

  it('lists a scene by its nodes, saying which one is picked', () => {
    withCube(['cube'])

    expect(frontTargets()?.targets()).toEqual([
      { id: 'cube', kind: 'node', name: 'Cube Test', selected: true },
    ])
  })

  it('arms the node aimed at, so the rest of the studio sees the pick', () => {
    withCube([])

    expect(aimAt('cube')).toEqual({ ok: true })
    expect(sceneOf(useScenes.getState(), SCENE).selectedIds).toEqual(['cube'])
  })

  // The ROW as well as the clip, and a clip stands under its own id — as `selectionNow` does.
  it('lists a montage by its rows and the clips on them', () => {
    installIn(
      sequenceStore,
      MONTAGE,
      {
        ...EMPTY_SEQUENCE,
        tracks: [
          makeTrack({
            id: 'V1',
            kind: 'video',
            index: 1,
            clips: [makeClip({ id: 'clip-1', assetId: 'asset-1', start: 0, duration: 4 })],
          }),
        ],
      },
      'video',
    )

    expect(frontTargets()?.targets()).toEqual([
      { id: 'V1', kind: 'track', name: 'V1', selected: false },
      { id: 'clip-1', kind: 'clip', name: 'clip-1', selected: false },
    ])
  })

  it('arms a row, and refuses an id the montage does not hold', () => {
    installIn(sequenceStore, MONTAGE, EMPTY_SEQUENCE, 'video')

    expect(aimAt('A1')).toEqual({ ok: true })
    expect(sequenceOf(useSequences.getState(), MONTAGE).selectedTrackId).toBe('A1')
    expect(aimAt('gone')).toEqual({ ok: false, refusal: 'notFound' })
  })
})
