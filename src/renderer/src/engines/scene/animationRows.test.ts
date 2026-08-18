import { describe, expect, it } from 'vitest'
import type { CameraShot } from '@shared/domain/animation'
import { SECOND } from '@shared/domain/time'
import { animationTrack, cameraShot, timelineWith } from './animation-fixtures'
import {
  CHANNEL_HEIGHT,
  SUBJECT_HEIGHT,
  animationRows,
  mergedKeys,
  subjectKey,
  trackIdsOf,
  type SheetLane,
} from './animationRows'

const CUBE = [{ id: 'cube', name: 'Circle' }]

const key = (seconds: number) => ({ time: seconds * SECOND, value: { x: 0, y: 0, z: 0 } })

const rowsOf = (
  tracks: Parameters<typeof timelineWith>[0],
  expanded: string[] = [],
  nodes = CUBE,
) => animationRows(timelineWith(tracks), { nodes, expanded: new Set(expanded) })

describe('the camera lines', () => {
  const CAMERAS = [
    { id: 'cam-a', name: 'Camera A' },
    { id: 'cam-b', name: 'Camera B' },
  ]

  const shotRowsOf = (...shots: CameraShot[]) =>
    animationRows(timelineWith([], { shots }), { nodes: CAMERAS, expanded: new Set() })

  // One line per camera, named by the camera, in the order the DOCUMENT lays its shots down —
  // that order is what settles an overlap, so the picture and `activeShotAt` cannot disagree.
  it('opens the sheet with the cameras on air, in the order the shots are held', () => {
    const rows = shotRowsOf(
      cameraShot('b1', { cameraId: 'cam-b' }),
      cameraShot('a1', { cameraId: 'cam-a' }),
    )

    expect(rows.map(row => row.name)).toEqual(['Camera B', 'Camera A'])
    expect(rows[0]).toMatchObject({ kind: 'subject', id: 'cam-b', height: SUBJECT_HEIGHT })
  })

  it('carries every shot of one camera on that camera’s own line', () => {
    const rows = shotRowsOf(
      cameraShot('first', { cameraId: 'cam-a' }),
      cameraShot('second', { cameraId: 'cam-a', start: 5 * SECOND }),
    )

    const line = rows[0]
    expect(line?.kind === 'subject' && line.bars?.map(bar => bar.shot.id)).toEqual([
      'first',
      'second',
    ])
  })

  // The same rule `activeShotAt` answers by: a bar naming nothing would be a line one could drag
  // and never see on screen.
  it('leaves out a shot whose camera the scene no longer holds', () => {
    const rows = shotRowsOf(cameraShot('gone', { cameraId: 'cam-gone' }))
    expect(rows.every(row => row.kind === 'subject' && row.bars === undefined)).toBe(true)
  })

  // The line is the camera's own, so folding it away has to give back its channels — which is
  // what tells a camera on air from a strip stuck at the top of the sheet.
  it('is the camera’s subject line, channels and all', () => {
    const rows = animationRows(
      timelineWith(
        [animationTrack('t1', 'fov', [key(1)], { target: { nodeId: 'cam-a', property: 'fov' } })],
        {
          shots: [cameraShot('a1', { cameraId: 'cam-a' })],
        },
      ),
      { nodes: CAMERAS, expanded: new Set(['cam-a']) },
    )

    expect(rows.map(row => row.kind)).toEqual(['subject', 'channel', 'subject'])
    expect(rows[0] && trackIdsOf(rows[0])).toEqual(['t1'])
  })
})

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
    expect(rows[0]?.kind === 'subject' && rows[0].name).toBe('Circle')
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
    expect(rows[1]?.kind === 'subject' && rows[1].name).toBe('Circle · Hips')
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

  it('ignores an entry for an object the scene no longer holds, and draws no hole for it', () => {
    expect(arranged(['gone', 'c', 'a', 'b'])).toEqual(['c', 'a', 'b'])
  })

  // Not at the bottom: a line the arrangement never saw comes back where the hierarchy puts it,
  // under the neighbours it already has.
  it('puts an object the arrangement never saw back beside its neighbours', () => {
    expect(arranged(['c', 'b'])).toEqual(['a', 'c', 'b'])
  })
})

describe('the lanes of an object', () => {
  const block = (clipId: string, start = 0) => ({
    clipId,
    name: clipId,
    start,
    duration: 2 * SECOND,
  })

  const sheetLane = (laneId: string, blocks: SheetLane['blocks'] = []): SheetLane => ({
    nodeId: 'cube',
    laneId,
    name: laneId,
    blocks,
  })

  const withLanes = (lanes: SheetLane[], expanded: string[] = ['cube']) =>
    animationRows(timelineWith([]), { nodes: CUBE, expanded: new Set(expanded), lanes })

  it('stays folded inside the track of its object, never at the foot of the sheet', () => {
    const rows = withLanes([sheetLane('main', [block('walk')])], [])

    expect(rows.map(row => row.kind)).toEqual(['subject'])
  })

  it('comes under the channels of its object once the track is unfolded', () => {
    const rows = withLanes([sheetLane('main', [block('walk')])])

    expect(rows.map(row => row.kind)).toEqual(['subject', 'lane'])
    expect(rows[1]).toMatchObject({ nodeId: 'cube', laneId: 'main' })
  })

  it('holds every block of the lane on one line, which is what laying them end to end is', () => {
    const rows = withLanes([sheetLane('main', [block('walk'), block('run', 4 * SECOND)])])

    expect(rows).toHaveLength(2)
    expect(rows[1]?.kind === 'lane' && rows[1].blocks.map(one => one.clipId)).toEqual([
      'walk',
      'run',
    ])
  })

  it('stacks the lanes of one object in the order the document holds them', () => {
    const rows = withLanes([sheetLane('first'), sheetLane('second')])

    expect(rows.map(row => row.kind === 'lane' && row.laneId)).toEqual([false, 'first', 'second'])
  })

  // A lane plays a whole rig at once, so it belongs to the object and never to one of its bones.
  it('gives no lane to a bone subject', () => {
    const rows = animationRows(
      timelineWith([
        animationTrack('a', 'rotation', [], {
          target: { nodeId: 'cube', bone: 'Hips', property: 'rotation' },
        }),
      ]),
      {
        nodes: CUBE,
        expanded: new Set(['cube', 'cube/Hips']),
        lanes: [sheetLane('main')],
      },
    )

    expect(rows.filter(row => row.kind === 'lane')).toHaveLength(1)
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
