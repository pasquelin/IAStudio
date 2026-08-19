import type { SequenceState } from './timelineState'
import { clipEnd } from './timelineState'
import { formatTimecode } from './timecode'

/**
 * CMX3600 — the edit decision list every online room still reads, and the oldest thing here.
 *
 * A flat text file of EVENTS: a number, a reel, a channel, a transition, and four timecodes —
 * where the shot starts and ends in its source, and where it starts and ends in the programme.
 * There is nothing else in it, which is why the losses are most of what a montage holds.
 *
 * One VIDEO track, and that is the format rather than a shortcut taken here: CMX3600 has one
 * `V` channel, and a second picture track would have to become a second file nobody asked for.
 * The audio tracks are written as `A`/`A2`, which is as far as the notation goes.
 */

/** Eight characters, the width a reel name has — an EDL is a fixed-column file. */
const REEL_WIDTH = 8

/** `AX` is the reel every tool writes for « no tape », which is what a file-based cut is. */
const NO_REEL = 'AX'

const reelOf = (name: string): string => {
  const plain = name.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  return (plain || NO_REEL).slice(0, REEL_WIDTH).padEnd(REEL_WIDTH)
}

/** `V`, `A` or `A2` — the three channels the notation has, and it has no more. */
function channelOf(kind: 'video' | 'audio', audioRow: number): string {
  if (kind === 'video') return 'V  '
  return audioRow === 0 ? 'A  ' : 'A2 '
}

type Event = {
  channel: string
  reel: string
  sourceIn: string
  sourceOut: string
  recordIn: string
  recordOut: string
  name: string
}

function eventsOf(state: SequenceState, nameOf: (assetId: string) => string): Event[] {
  const { fps } = state.settings
  const events: Event[] = []
  let audioRow = 0

  for (const track of [...state.tracks].reverse()) {
    // The row a track takes in the notation, counted over the AUDIO ones alone: `A` and `A2` are
    // the two the format has, and a third audio track lands on `A2` with the second.
    const row = track.kind === 'audio' ? audioRow++ : 0

    for (const clip of track.clips) {
      // A clip drawing a live scene names no rush, and an event pointing at nothing is a shot an
      // online room cannot conform. `liveScene` is declared dropped; this is it being dropped.
      if (!clip.assetId) continue

      const name = nameOf(clip.assetId)
      events.push({
        channel: channelOf(track.kind, row),
        reel: reelOf(name),
        // The source range, which is the trim — an EDL says which part of the rush is used.
        sourceIn: formatTimecode(clip.inPoint, fps),
        sourceOut: formatTimecode(clip.inPoint + clip.duration, fps),
        recordIn: formatTimecode(clip.start, fps),
        recordOut: formatTimecode(clipEnd(clip), fps),
        name,
      })
    }
  }
  return events
}

/**
 * The list as a file. `NON-DROP FRAME` unconditionally: drop frame is a counting trick for the
 * 29.97 rates, and a sequence here carries a whole number of frames per second.
 *
 * `C` for every event — a straight cut. A fade held by a clip is not a transition BETWEEN two
 * shots, which is the only thing `D` can spell, so writing one would change the cut.
 */
export function edlOf(
  state: SequenceState,
  title: string,
  nameOf: (assetId: string) => string,
): string {
  const lines = [`TITLE: ${title.toUpperCase()}`, 'FCM: NON-DROP FRAME']

  eventsOf(state, nameOf).forEach((event, at) => {
    lines.push(
      [
        String(at + 1).padStart(3, '0'),
        event.reel,
        event.channel,
        'C  ',
        event.sourceIn,
        event.sourceOut,
        event.recordIn,
        event.recordOut,
      ].join(' '),
      `* FROM CLIP NAME: ${event.name}`,
    )
  })

  // A trailing newline: a text file without one is a line some readers drop.
  return `${lines.join('\n')}\n`
}
