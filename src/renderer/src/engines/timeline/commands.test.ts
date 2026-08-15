import { describe, expect, it } from 'vitest'
import {
  addClip,
  addClips,
  addTrack,
  moveClip,
  moveTrack,
  removeClip,
  removeTrack,
  setClipSpeed,
  splitClip,
  trimClip,
  unlinkClip,
} from './commands'
import { clipFixture, sequenceWith, trackFixture } from './timeline-fixtures'
import { reindexTracks, type Clip, type SequenceState } from './timeline-state'

const clip = clipFixture

const withClips = (clips: Clip[], locked = false): SequenceState =>
  sequenceWith([
    trackFixture('V1', 'video', clips, { locked }),
    trackFixture('V2', 'video', [], { index: 2 }),
  ])

describe('sequence commands', () => {
  it('adds a clip and selects it', () => {
    const command = addClip('V1', clip('a', 0, 1_000))
    const next = command.apply(withClips([]))
    expect(next.tracks[0]?.clips).toHaveLength(1)
    expect(next.selectedId).toBe('a')
  })

  it('reverts an add by removing the clip again', () => {
    const command = addClip('V1', clip('a', 0, 1_000))
    const state = withClips([])
    expect(command.revert(command.apply(state))).toEqual(state)
  })

  it('leaves a locked track untouched', () => {
    const command = addClip('V1', clip('a', 0, 1_000))
    const state = withClips([], true)
    expect(command.apply(state)).toEqual(state)
  })

  it('moves a clip to another track at a snapped position', () => {
    const command = moveClip('a', 'V2', 41_000)
    const next = command.apply(withClips([clip('a', 0, 1_000)]))
    expect(next.tracks[0]?.clips).toHaveLength(0)
    expect(next.tracks[1]?.clips[0]).toMatchObject({ id: 'a', start: 40_000 })
  })

  it('reverts a move back to the original track and position', () => {
    const command = moveClip('a', 'V2', 41_000)
    const state = withClips([clip('a', 0, 1_000)])
    expect(command.revert(command.apply(state))).toEqual(state)
  })

  it('trims the out edge', () => {
    const command = trimClip('a', 'out', 600_000, 'unknown')
    const next = command.apply(withClips([clip('a', 0, 1_000_000)]))
    expect(next.tracks[0]?.clips[0]).toMatchObject({ start: 0, duration: 600_000, inPoint: 0 })
  })

  it('trims the in edge, moving both start and in point', () => {
    const command = trimClip('a', 'in', 200_000, 'still')
    const next = command.apply(withClips([clip('a', 0, 1_000_000)]))
    expect(next.tracks[0]?.clips[0]).toMatchObject({
      start: 200_000,
      duration: 800_000,
      inPoint: 200_000,
    })
  })

  it('refuses a trim that would leave nothing rather than clamping it to zero', () => {
    const state = withClips([clip('a', 0, 1_000_000)])
    expect(trimClip('a', 'out', 0, 'unknown').apply(state)).toEqual(state)
    expect(trimClip('a', 'in', 1_000_000, 'unknown').apply(state)).toEqual(state)
  })

  it('splits a clip in two, the second one starting later in the source', () => {
    const next = splitClip('a', 400_000).apply(withClips([clip('a', 0, 1_000_000)]))
    expect(next.tracks[0]?.clips).toHaveLength(2)
    expect(next.tracks[0]?.clips[0]).toMatchObject({ start: 0, duration: 400_000, inPoint: 0 })
    expect(next.tracks[0]?.clips[1]).toMatchObject({
      start: 400_000,
      duration: 600_000,
      inPoint: 400_000,
    })
  })

  it('gives each insertion its own tail id, so two drops on one neighbour stay distinct', () => {
    const first = addClip('V1', clip('b', 1_000, 1_000)).apply(withClips([clip('a', 0, 3_000)]))
    const second = addClip('V1', clip('c', 200, 400)).apply(first)
    const ids = second.tracks[0]?.clips.map(candidate => candidate.id) ?? []

    expect(ids).toHaveLength(5)
    expect(new Set(ids).size).toBe(5)
  })

  it('gives each cut its own tail id, so cutting the same clip twice keeps ids distinct', () => {
    const once = splitClip('a', 2_000_000).apply(withClips([clip('a', 0, 4_000_000)]))
    const twice = splitClip('a', 1_000_000).apply(once)
    const ids = twice.tracks[0]?.clips.map(candidate => candidate.id) ?? []

    expect(ids).toHaveLength(3)
    expect(new Set(ids).size).toBe(3)
  })

  it('keeps the tail id stable across a redo, so nothing points at a clip that moved', () => {
    const command = splitClip('a', 400_000)
    const state = withClips([clip('a', 0, 1_000_000)])
    const first = command.apply(state)
    const again = command.apply(command.revert(first))

    expect(again.tracks[0]?.clips[1]?.id).toBe(first.tracks[0]?.clips[1]?.id)
  })

  it('refuses a split on an exact edge, which would produce an empty clip', () => {
    const state = withClips([clip('a', 0, 1_000_000)])
    expect(splitClip('a', 0).apply(state)).toEqual(state)
    expect(splitClip('a', 1_000_000).apply(state)).toEqual(state)
  })

  it('reverts a split by restoring the single clip', () => {
    const command = splitClip('a', 400_000)
    const state = withClips([clip('a', 0, 1_000_000)])
    expect(command.revert(command.apply(state))).toEqual(state)
  })

  it('reverts a removal at the original index', () => {
    const command = removeClip('a')
    const state = withClips([clip('a', 0, 1_000), clip('b', 2_000, 1_000)])
    expect(command.revert(command.apply(state))).toEqual(state)
  })

  it('restores the previous selection when an add is reverted', () => {
    const state = { ...withClips([clip('b', 0, 1_000)]), selectedId: 'b' }
    const command = addClip('V1', clip('a', 5_000, 1_000))
    expect(command.revert(command.apply(state)).selectedId).toBe('b')
  })

  it('grows a trim over the neighbour, which gives way as it would under a drop', () => {
    const state = withClips([clip('a', 0, 1_000_000), clip('b', 1_000_000, 1_000_000)])
    const next = trimClip('a', 'out', 1_800_000, 'unknown').apply(state)

    expect(next.tracks[0]?.clips[0]).toMatchObject({ id: 'a', duration: 1_800_000 })
    // What is left of the neighbour starts later in the source, as a trimmed head does.
    expect(next.tracks[0]?.clips[1]).toMatchObject({
      id: 'b',
      start: 1_800_000,
      duration: 200_000,
      inPoint: 800_000,
    })
  })

  it('swallows a neighbour a trim covers whole', () => {
    const state = withClips([clip('a', 0, 1_000_000), clip('b', 1_000_000, 500_000)])
    const next = trimClip('a', 'out', 2_000_000, 'unknown').apply(state)

    expect(next.tracks[0]?.clips.map(candidate => candidate.id)).toEqual(['a'])
  })

  it('grows the in point over the clip before it too', () => {
    const state = withClips([
      clip('a', 0, 1_000_000),
      clip('b', 1_000_000, 1_000_000, {
        inPoint: 1_000_000,
      }),
    ])
    const next = trimClip('b', 'in', 400_000, 'unknown').apply(state)

    expect(next.tracks[0]?.clips[0]).toMatchObject({ id: 'a', duration: 400_000 })
    expect(next.tracks[0]?.clips[1]).toMatchObject({ id: 'b', start: 400_000, inPoint: 400_000 })
  })

  it('puts back the neighbours a trim overwrote', () => {
    const command = trimClip('a', 'out', 1_800_000, 'unknown')
    const state = withClips([clip('a', 0, 1_000_000), clip('b', 1_000_000, 1_000_000)])

    expect(command.revert(command.apply(state)).tracks[0]?.clips).toEqual(state.tracks[0]?.clips)
  })

  it('lets a trim run freely when there is no neighbour in the way', () => {
    const next = trimClip('a', 'out', 3_000_000, 'unknown').apply(
      withClips([clip('a', 0, 1_000_000)]),
    )
    expect(next.tracks[0]?.clips[0]?.duration).toBe(3_000_000)
  })

  it('stops the out point where the source ends', () => {
    const state = withClips([clip('a', 0, 1_000_000)])
    const next = trimClip('a', 'out', 9_000_000, 2_000_000).apply(state)

    // A clip stretched past its source freezes on a frame while its sound goes silent.
    expect(next.tracks[0]?.clips[0]?.duration).toBe(2_000_000)
  })

  it('counts the source from the in point, not from the clip start', () => {
    const state = withClips([clip('a', 0, 1_000_000, { inPoint: 1_500_000 })])
    const next = trimClip('a', 'out', 9_000_000, 2_000_000).apply(state)

    expect(next.tracks[0]?.clips[0]?.duration).toBe(500_000)
  })

  it('measures the source at the clip speed, which is what the decoder reads at', () => {
    const state = withClips([clip('a', 0, 1_000_000, { speed: 2 })])
    const next = trimClip('a', 'out', 9_000_000, 2_000_000).apply(state)

    // Two seconds of source run past in one second of timeline at double speed.
    expect(next.tracks[0]?.clips[0]?.duration).toBe(1_000_000)
  })

  it('stops the in point where the source begins', () => {
    const state = withClips([clip('a', 1_000_000, 1_000_000, { inPoint: 400_000 })])
    const next = trimClip('a', 'in', 0, 5_000_000).apply(state)

    expect(next.tracks[0]?.clips[0]).toMatchObject({ start: 600_000, inPoint: 0 })
  })

  it('leaves a still unbounded, which is how a title card is stretched', () => {
    const next = trimClip('a', 'out', 9_000_000, 'still').apply(
      withClips([clip('a', 0, 1_000_000)]),
    )
    expect(next.tracks[0]?.clips[0]?.duration).toBe(9_000_000)
  })

  it('lengthens a still by its in edge too, which a source-bound clip cannot do', () => {
    const state = withClips([clip('a', 2_000_000, 1_000_000)])
    const next = trimClip('a', 'in', 1_000_000, 'still').apply(state)

    // The image has no source to run past, so pulling its left end grows it the way the right
    // end already did — the bound there only ever made sense for a video.
    expect(next.tracks[0]?.clips[0]).toMatchObject({ start: 1_000_000, duration: 2_000_000 })
  })

  it('holds a stretched still at the start of the sequence, never before it', () => {
    const state = withClips([clip('a', 1_000_000, 1_000_000)])
    const next = trimClip('a', 'in', -5_000_000, 'still').apply(state)

    expect(next.tracks[0]?.clips[0]?.start).toBe(0)
  })

  it('holds a stretched still at its source start, so the project reloads as it was saved', () => {
    const state = withClips([clip('a', 2_000_000, 1_000_000)])
    const next = trimClip('a', 'in', 1_000_000, 'still').apply(state)

    // `readPositive` drops a negative in point on reload; a clip that came back with a different
    // one would not be the clip that was saved.
    expect(next.tracks[0]?.clips[0]?.inPoint).toBe(0)
  })

  /**
   * `mediaDuration` answers null for a still AND for an asset nobody has probed yet, so the two
   * used to arrive here as the same thing. Only the first has no source: a rush whose length is
   * merely unknown still starts somewhere, and letting its in point run before that start would
   * freeze the tail of the clip on a frame with its sound gone.
   */
  it('keeps the in point bounded on a rush nobody has probed yet, unlike a still', () => {
    const state = withClips([clip('a', 2_000_000, 1_000_000)])
    const next = trimClip('a', 'in', 1_000_000, 'unknown').apply(state)

    // Its in point is zero, so `clip.start - headroom(0)` is the clip's own start: refused.
    expect(next).toEqual(state)
  })

  it('lets an unprobed rush give back the head it had already trimmed, and no more', () => {
    const state = withClips([clip('a', 2_000_000, 1_000_000, { inPoint: 400_000 })])
    const next = trimClip('a', 'in', 1_000_000, 'unknown').apply(state)

    expect(next.tracks[0]?.clips[0]).toMatchObject({ start: 1_600_000, inPoint: 0 })
  })

  it('still stops a video at its source start, which is the bound a still does not have', () => {
    const state = withClips([clip('a', 2_000_000, 1_000_000, { inPoint: 400_000 })])
    const next = trimClip('a', 'in', 1_000_000, 5_000_000).apply(state)

    expect(next.tracks[0]?.clips[0]).toMatchObject({ start: 1_600_000, inPoint: 0 })
  })

  it('puts back the neighbours an added clip overwrote', () => {
    const command = addClip('V1', clip('b', 500_000, 1_000_000))
    const state = withClips([clip('a', 0, 2_000_000)])

    const after = command.apply(state)
    expect(after.tracks[0]?.clips).toHaveLength(3)

    // Undo has to give back the state it was pressed from, not just remove the newcomer.
    expect(command.revert(after).tracks[0]?.clips).toEqual(state.tracks[0]?.clips)
  })

  it('puts back the neighbours a moved clip overwrote on the track it landed on', () => {
    const state = withClips([clip('a', 0, 500_000)])
    const seeded = addClip('V2', clip('x', 1_000_000, 2_000_000)).apply(state)

    const command = moveClip('a', 'V2', 1_500_000)
    const after = command.apply(seeded)
    const back = command.revert(after)

    expect(back.tracks[1]?.clips).toEqual(seeded.tracks[1]?.clips)
    expect(back.tracks[0]?.clips).toEqual(seeded.tracks[0]?.clips)
  })
})

/**
 * A take is two clips, and an editor expects them to behave as one thing: what an edit does to
 * the picture it does to the sound, until the two are unlinked on purpose. Anything less drifts
 * lip sync on the first drag, which is the one defect an edit cannot recover from by eye.
 */
describe('a take whose picture and sound are linked', () => {
  const LINK = 'link-1'

  const take = (): SequenceState =>
    sequenceWith([
      trackFixture('V1', 'video', [clipFixture('v', 1_000_000, 2_000_000, { linkId: LINK })]),
      trackFixture('A1', 'audio', [clipFixture('a', 1_000_000, 2_000_000, { linkId: LINK })]),
    ])

  const clipOf = (state: SequenceState, id: string): Clip | undefined =>
    state.tracks.flatMap(track => track.clips).find(clip => clip.id === id)

  it('drags the sound along when the picture is dragged, and back on undo', () => {
    const command = moveClip('v', 'V1', 3_000_000)
    const state = take()

    const moved = command.apply(state)

    expect(clipOf(moved, 'v')?.start).toBe(3_000_000)
    expect(clipOf(moved, 'a')?.start).toBe(3_000_000)
    expect(command.revert(moved)).toEqual(state)
  })

  // The twin stays where it can be heard: one audio track is the ordinary sequence, and a sound
  // moved onto a picture track is painted rather than played.
  it('keeps the sound on its own track when the picture changes track', () => {
    const moved = moveClip('v', 'V2', 1_000_000).apply({
      ...take(),
      tracks: [...take().tracks, trackFixture('V2', 'video', [], { index: 2 })],
    })

    expect(moved.tracks.find(track => track.id === 'V2')?.clips).toHaveLength(1)
    expect(moved.tracks.find(track => track.id === 'A1')?.clips).toHaveLength(1)
  })

  /**
   * Every one of these commands selects what it edited, and the twin is applied last: clicking
   * the picture put the inspector on the sound, and the sound on the picture. It read as a
   * montage that selects the wrong half of everything.
   */
  it('leaves the selection on the half that was touched', () => {
    expect(moveClip('v', 'V1', 3_000_000).apply(take()).selectedId).toBe('v')
    expect(moveClip('a', 'A1', 3_000_000).apply(take()).selectedId).toBe('a')
  })

  it('trims both edges together', () => {
    const trimmed = trimClip('v', 'out', 2_000_000, 'unknown').apply(take())

    expect(clipOf(trimmed, 'v')?.duration).toBe(1_000_000)
    expect(clipOf(trimmed, 'a')?.duration).toBe(1_000_000)
  })

  it('cuts both, and ties the two tails to each other rather than to the heads', () => {
    const cut = splitClip('v', 2_000_000).apply(take())
    const clips = cut.tracks.flatMap(track => track.clips)
    const tails = clips.filter(clip => clip.start === 2_000_000)
    const heads = clips.filter(clip => clip.start === 1_000_000)

    expect(tails).toHaveLength(2)
    expect(tails[0]?.linkId).toBe(tails[1]?.linkId)
    expect(heads[0]?.linkId).toBe(LINK)
    // Otherwise dragging one head would drag the far side of the cut with it.
    expect(tails[0]?.linkId).not.toBe(LINK)
  })

  it('deletes both, since a picture whose sound stays behind is never what was meant', () => {
    const cleared = removeClip('v').apply(take())
    expect(cleared.tracks.flatMap(track => track.clips)).toEqual([])
  })

  /**
   * `speed` is read on both sides — `sourceTimeAt` seeks the picture with it, `SoundCue.rate`
   * resamples the sound with it — so a change on one half alone drifts the two apart for good.
   * A gain and a fade are each half's own business and stay unlinked.
   */
  it('runs the sound at the speed the picture was given', () => {
    const faster = setClipSpeed('v', 2).apply(take())

    expect(clipOf(faster, 'v')?.speed).toBe(2)
    expect(clipOf(faster, 'a')?.speed).toBe(2)
  })

  it('unties the pair, so each half can then be edited alone', () => {
    const command = unlinkClip('v')
    const state = take()

    const untied = command.apply(state)

    expect(clipOf(untied, 'v')?.linkId).toBeUndefined()
    expect(clipOf(untied, 'a')?.linkId).toBeUndefined()
    // Undo puts the link back: unlinking is an edit like any other.
    expect(command.revert(untied)).toEqual(state)
    expect(clipOf(removeClip('v').apply(untied), 'a')).toBeDefined()
  })

  /**
   * Both halves or neither. A locked sound track is an ordinary editing move, and the edit went
   * through on the picture alone: the take was then desynced for good, which is the one failure
   * the link exists to prevent.
   */
  it('refuses the whole edit when one half sits on a locked track', () => {
    const state = sequenceWith([
      trackFixture('V1', 'video', [clipFixture('v', 1_000_000, 2_000_000, { linkId: LINK })]),
      trackFixture('A1', 'audio', [clipFixture('a', 1_000_000, 2_000_000, { linkId: LINK })], {
        locked: true,
      }),
    ])

    expect(moveClip('v', 'V1', 3_000_000).apply(state)).toBe(state)
    expect(trimClip('v', 'out', 2_000_000, 'unknown').apply(state)).toBe(state)
    expect(removeClip('v').apply(state)).toBe(state)
  })

  /**
   * A clip dropped inside a linked take leaves two pieces of it. Sharing one link, the head and
   * the far side of the cut moved and were deleted together — and the sound followed whichever
   * of them was dragged.
   */
  it('leaves the tail of an insertion unlinked, since only the head kept its sound', () => {
    const cut = addClip('V1', clipFixture('b', 2_000_000, 500_000)).apply(take())
    const clips = cut.tracks[0]?.clips ?? []

    expect(clips.map(clip => clip.start)).toEqual([1_000_000, 2_000_000, 2_500_000])
    expect(clips[0]?.linkId).toBe(LINK)
    expect(clips[2]?.linkId).toBeUndefined()
  })

  it('lays a take down as one history entry, so undo takes back both clips', () => {
    const command = addClips([
      { trackId: 'V1', clip: clipFixture('v', 0, 1_000_000, { linkId: LINK }) },
      { trackId: 'A1', clip: clipFixture('a', 0, 1_000_000, { linkId: LINK }) },
    ])
    const state = sequenceWith([trackFixture('V1', 'video'), trackFixture('A1', 'audio')])

    const dropped = command.apply(state)

    expect(dropped.tracks.flatMap(track => track.clips)).toHaveLength(2)
    // The picture, never the last part that ran: it is the half the user aimed at.
    expect(dropped.selectedId).toBe('v')
    expect(command.revert(dropped)).toEqual(state)
  })
})

describe('track commands', () => {
  const twoTracks = (): SequenceState =>
    sequenceWith([trackFixture('V1', 'video'), trackFixture('A1', 'audio')])

  it('adds a track at the bottom, named after the first free number of its kind', () => {
    const next = addTrack('video').apply(twoTracks())
    expect(next.tracks.map(track => track.id)).toEqual(['V1', 'A1', 'V2'])
  })

  it('gives two adds two names, since the second sees what the first took', () => {
    const state = addTrack('audio').apply(twoTracks())
    const next = addTrack('audio').apply(state)
    expect(next.tracks.map(track => track.id)).toEqual(['V1', 'A1', 'A2', 'A3'])
  })

  it('reverts an add by taking the track back out', () => {
    const command = addTrack('video')
    const state = twoTracks()
    expect(command.revert(command.apply(state))).toEqual(state)
  })

  it('reads depth back from position, so the top row is the one drawn on top', () => {
    const next = addTrack('video').apply(twoTracks())
    expect(next.tracks.map(track => track.index)).toEqual([2, 1, 0])
  })

  it('removes a track with the clips it carried', () => {
    const state = sequenceWith([
      trackFixture('V1', 'video', [clipFixture('a', 0, 1_000)]),
      trackFixture('A1', 'audio'),
    ])
    const next = removeTrack('V1').apply(state)
    expect(next.tracks.map(track => track.id)).toEqual(['A1'])
  })

  it('puts a removed track back on the row it was on, clips and all', () => {
    const state = sequenceWith([
      trackFixture('V1', 'video'),
      trackFixture('V2', 'video', [clipFixture('a', 0, 1_000)], { index: 2 }),
      trackFixture('A1', 'audio'),
    ])
    const command = removeTrack('V2')
    const back = command.revert(command.apply(state))
    expect(back.tracks.map(track => track.id)).toEqual(['V1', 'V2', 'A1'])
    expect(back.tracks[1]?.clips).toHaveLength(1)
  })

  it('drops the selection when the removed track was carrying it', () => {
    const state = {
      ...sequenceWith([
        trackFixture('V1', 'video', [clipFixture('a', 0, 1_000)]),
        trackFixture('A1', 'audio'),
      ]),
      selectedId: 'a',
    }
    expect(removeTrack('V1').apply(state).selectedId).toBeNull()
  })

  it('leaves a locked track where it is', () => {
    const state = sequenceWith([trackFixture('V1', 'video', [], { locked: true })])
    expect(removeTrack('V1').apply(state)).toEqual(state)
  })

  it('moves a track one row down', () => {
    const next = moveTrack('V1', 1).apply(twoTracks())
    expect(next.tracks.map(track => track.id)).toEqual(['A1', 'V1'])
  })

  it('refuses to move a track off either end', () => {
    const state = twoTracks()
    expect(moveTrack('V1', -1).apply(state)).toEqual(state)
    expect(moveTrack('A1', 1).apply(state)).toEqual(state)
  })

  it('reverts a move by putting the track back on its row', () => {
    const command = moveTrack('V1', 1)
    const state = twoTracks()
    expect(command.revert(command.apply(state))).toEqual(state)
  })

  // What a DRAG costs: successive steps coalesce into one entry keeping the first revert, and by
  // then the track stands several rows from where a `from + by` arithmetic would look for it.
  it('reverts a run of steps in one press, from wherever the track ended up', () => {
    // Already reindexed, as every montage on screen is: a fixture's own indices are not the
    // stack's, and the comparison below is about rows, not about numbering.
    const state = sequenceWith(
      reindexTracks([
        trackFixture('V1', 'video'),
        trackFixture('V2', 'video'),
        trackFixture('A1', 'audio'),
      ]),
    )
    const first = moveTrack('V1', 1)
    const second = moveTrack('V1', 1)

    const dragged = second.apply(first.apply(state))
    expect(dragged.tracks.map(track => track.id)).toEqual(['V2', 'A1', 'V1'])
    expect(first.revert(dragged)).toEqual(state)
  })

  // The other half of the same entry: ⌘⇧Z has to put the track back where the drag left it, and
  // the last step alone knows only its own `by`.
  it('replays the whole drag on redo, not its last step', () => {
    const state = sequenceWith(
      reindexTracks([
        trackFixture('V1', 'video'),
        trackFixture('V2', 'video'),
        trackFixture('A1', 'audio'),
      ]),
    )
    const first = moveTrack('V1', 1)
    const second = moveTrack('V1', 1)
    const dragged = second.apply(first.apply(state))

    expect(second.apply(first.revert(dragged)).tracks.map(track => track.id)).toEqual([
      'V2',
      'A1',
      'V1',
    ])
  })

  it('re-reads depth after a move, so what is drawn follows what is shown', () => {
    const next = moveTrack('V1', 1).apply(twoTracks())
    expect(next.tracks.map(track => [track.id, track.index])).toEqual([
      ['A1', 1],
      ['V1', 0],
    ])
  })
})
