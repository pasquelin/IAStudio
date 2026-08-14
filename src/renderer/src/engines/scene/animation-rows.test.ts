import { describe, expect, it } from 'vitest'
import { SECOND } from '@shared/domain/time'
import { animationTrack, timelineWith } from './animation-fixtures'
import {
  CHANNEL_HEIGHT,
  SUBJECT_HEIGHT,
  animationRows,
  mergedKeys,
  movedWithin,
  subjectKey,
  trackIdsOf,
} from './animation-rows'

const CUBE = [{ id: 'cube', name: 'Circle' }]

const key = (seconds: number) => ({ time: seconds * SECOND, value: { x: 0, y: 0, z: 0 } })

const rowsOf = (
  tracks: Parameters<typeof timelineWith>[0],
  expanded: string[] = [],
  nodes = CUBE,
) => animationRows(timelineWith(tracks), { nodes, expanded: new Set(expanded) })

describe('naming a subject', () => {
  it('is the node alone when no bone is addressed', () => {
    expect(subjectKey({ nodeId: 'cube' })).toBe('cube')
  })

  it('separates the bone, so two bones of one rig are two subjects', () => {
    expect(subjectKey({ nodeId: 'rig', bone: 'Hips' })).toBe('rig/Hips')
    expect(subjectKey({ nodeId: 'rig', bone: 'Arm' })).not.toBe(subjectKey({ nodeId: 'rig' }))
  })
})

describe('merging the keys of a subject', () => {
  it('shows each instant once, however many channels hold one there', () => {
    const tracks = [
      animationTrack('a', 'position', [key(0), key(2)]),
      animationTrack('b', 'rotation', [key(0), key(1)]),
    ]
    expect(mergedKeys(tracks)).toEqual([0, 1 * SECOND, 2 * SECOND])
  })

  it('orders them, whatever order the channels arrived in', () => {
    const tracks = [
      animationTrack('a', 'position', [key(5)]),
      animationTrack('b', 'scale', [key(1)]),
    ]
    expect(mergedKeys(tracks)).toEqual([1 * SECOND, 5 * SECOND])
  })

  it('answers nothing for channels that hold none', () => {
    expect(mergedKeys([animationTrack('a', 'position', [])])).toEqual([])
    expect(mergedKeys([])).toEqual([])
  })
})

describe('laying out the sheet', () => {
  it('gives a line to an object that holds no channel at all — nothing to create first', () => {
    expect(rowsOf([])).toHaveLength(1)
    expect(rowsOf([])[0]).toMatchObject({ kind: 'subject', name: 'Circle', keys: [] })
  })

  it('gives one line per object, whatever its channel count', () => {
    const rows = rowsOf([
      animationTrack('a', 'position', []),
      animationTrack('b', 'rotation', []),
      animationTrack('c', 'scale', []),
    ])

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ kind: 'subject', name: 'Circle', height: SUBJECT_HEIGHT })
  })

  it('names the object plainly, not with the composed name its tracks carry', () => {
    const rows = rowsOf([animationTrack('a', 'position', [], { name: 'Circle · Position' })])
    expect(rows[0]?.name).toBe('Circle')
  })

  it('folds the channels away until the subject is unfolded', () => {
    const tracks = [
      animationTrack('a', 'position', [], { name: 'Circle · Position' }),
      animationTrack('b', 'scale', [], { name: 'Circle · Scale' }),
    ]

    expect(rowsOf(tracks)).toHaveLength(1)

    const opened = rowsOf(tracks, ['cube'])
    expect(opened).toHaveLength(3)
    expect(opened[1]).toMatchObject({
      kind: 'channel',
      name: 'Circle · Position',
      height: CHANNEL_HEIGHT,
    })
  })

  it('shows every key of a folded subject, so folding loses nothing', () => {
    const rows = rowsOf([
      animationTrack('a', 'position', [key(0)]),
      animationTrack('b', 'rotation', [key(3)]),
    ])

    expect(rows[0]?.kind === 'subject' && rows[0].keys).toEqual([0, 3 * SECOND])
  })

  it('separates a bone from the model it belongs to', () => {
    const rows = rowsOf([
      animationTrack('a', 'position', [], { target: { nodeId: 'cube', property: 'position' } }),
      animationTrack('b', 'rotation', [], {
        target: { nodeId: 'cube', bone: 'Hips', property: 'rotation' },
      }),
    ])

    expect(rows).toHaveLength(2)
    expect(rows[1]?.name).toBe('Circle · Hips')
  })

  it('keeps the objects in the order the scene holds them, so rows never jump', () => {
    const nodes = [
      { id: 'zebra', name: 'zebra' },
      { id: 'alpha', name: 'alpha' },
    ]
    const rows = rowsOf([], [], nodes)

    expect(rows.map(row => row.id)).toEqual(['zebra', 'alpha'])
  })

  it('answers nothing at all for a scene with no object', () => {
    expect(rowsOf([], [], [])).toEqual([])
  })
})

describe('arranging the lines', () => {
  const THREE = [
    { id: 'a', name: 'a' },
    { id: 'b', name: 'b' },
    { id: 'c', name: 'c' },
  ]

  const arranged = (order: string[]) =>
    animationRows(timelineWith([]), { nodes: THREE, expanded: new Set(), order }).map(row => row.id)

  it('shows the lines in the order the user arranged, not the scene order', () => {
    expect(arranged(['c', 'a', 'b'])).toEqual(['c', 'a', 'b'])
  })

  it('lands an object added since the arrangement was made, rather than losing it', () => {
    expect(arranged(['c', 'a'])).toEqual(['c', 'a', 'b'])
  })

  it('ignores an entry for an object the scene no longer holds', () => {
    expect(arranged(['gone', 'b'])).toEqual(['b', 'a', 'c'])
  })

  it('moves one line and leaves the others in place', () => {
    expect(movedWithin(['a', 'b', 'c'], 'c', -1)).toEqual(['a', 'c', 'b'])
    expect(movedWithin(['a', 'b', 'c'], 'a', 2)).toEqual(['b', 'c', 'a'])
  })

  it('stops at the ends rather than wrapping, so a line dragged up has arrived', () => {
    expect(movedWithin(['a', 'b', 'c'], 'a', -3)).toEqual(['a', 'b', 'c'])
    expect(movedWithin(['a', 'b', 'c'], 'c', 5)).toEqual(['a', 'b', 'c'])
  })
})

describe('what a row acts on', () => {
  it('gives every channel of a folded subject, so one key lands on all three', () => {
    const rows = rowsOf([animationTrack('a', 'position', []), animationTrack('b', 'rotation', [])])

    expect(rows[0] && trackIdsOf(rows[0])).toEqual(['a', 'b'])
  })

  it('gives the one channel of an unfolded row', () => {
    const rows = rowsOf([animationTrack('a', 'position', [])], ['cube'])
    expect(rows[1] && trackIdsOf(rows[1])).toEqual(['a'])
  })
})
