import type { ActionOutcome } from '@shared/domain/assistant'
import { answered, done, front, nextId, refused, type Bench, type StudioDocument } from './bench'
import { number, text, type Input } from './inputs'

/** Everything a montage answers — the clips and tracks of sections 15 to 17. */

const MONTAGE = ['video', 'audio']

/** What a clip lands with when nothing has trimmed it — the length of its source. */
const SOURCE_LENGTH = 6_000_000

const aimed = (montage: StudioDocument, input: Input) =>
  montage.clips.find(one => one.id === text(input, 'clipId'))

/** Where a montage ends: the last frame any clip reaches, which is what "exactly" is read on. */
const endOf = (montage: StudioDocument): number =>
  montage.clips.reduce((last, one) => Math.max(last, one.start + one.duration), 0)

const stateOf = (montage: StudioDocument): unknown => ({
  documentId: montage.id,
  duration: montage.duration,
  end: endOf(montage),
  tracks: montage.tracks.map(one => ({ id: one.id, kind: one.kind, name: one.name })),
  clips: montage.clips.map(one => ({
    id: one.id,
    trackId: one.trackId,
    assetId: one.assetId,
    start: one.start,
    duration: one.duration,
    gain: one.gain,
    fadeIn: one.fadeIn,
    fadeOut: one.fadeOut,
    speed: one.speed,
  })),
})

export function montageAction(bench: Bench, action: string, input: Input): ActionOutcome | null {
  const montage = front(bench)
  if (!montage || !MONTAGE.includes(montage.space)) return null

  switch (action) {
    case 'sequence.state':
      return answered(stateOf(montage))

    case 'sequence.seek':
      return number(input, 'time') === null ? refused('badInput') : done

    // `kind` and nothing else: the name is `track.rename`'s to give, and a bench taking one here
    // scored a call the studio refuses.
    case 'track.add': {
      const kind = text(input, 'kind') === 'audio' ? 'audio' : 'video'
      const same = montage.tracks.filter(one => one.kind === kind).length
      const track = {
        id: nextId(bench, 'track'),
        kind: kind as 'video' | 'audio',
        name: `${kind === 'audio' ? 'A' : 'V'}${same + 1}`,
        muted: false,
      }
      montage.tracks.push(track)
      montage.modified = true
      return answered({ trackId: track.id })
    }

    case 'track.remove': {
      const id = text(input, 'trackId')
      montage.tracks = montage.tracks.filter(one => one.id !== id)
      montage.clips = montage.clips.filter(one => one.trackId !== id)
      return done
    }

    case 'track.rename': {
      const track = montage.tracks.find(one => one.id === text(input, 'trackId'))
      const name = text(input, 'name')
      if (!track || name === '') return refused('badInput')

      track.name = name
      return done
    }

    case 'track.adjust': {
      const track = montage.tracks.find(one => one.id === text(input, 'trackId'))
      if (!track) return refused('badInput')

      if (input['muted'] !== undefined) track.muted = input['muted'] === true
      return done
    }

    /**
     * No DURATION here, and it matters: a clip lands with the length of its source, and « pendant
     * 5 secondes » is a `clip.trim` after it. A bench accepting a duration let a plan skip the
     * second call and scored a montage the studio would not have built.
     */
    case 'clip.add': {
      const assetId = text(input, 'assetId')
      const named = text(input, 'trackId')
      const track =
        montage.tracks.find(one => one.id === named) ??
        (named === '' ? montage.tracks[0] : undefined)
      if (assetId === '' || !track) return refused('badInput')

      const clip = {
        id: nextId(bench, 'clip'),
        trackId: track.id,
        assetId,
        start: number(input, 'start') ?? 0,
        duration: SOURCE_LENGTH,
        offset: 0,
        gain: 0,
        fadeIn: 0,
        fadeOut: 0,
        speed: 1,
      }
      montage.clips.push(clip)
      montage.duration = Math.max(montage.duration, endOf(montage))
      montage.modified = true
      return answered({ clipId: clip.id })
    }

    case 'clip.remove': {
      const clip = aimed(montage, input)
      if (!clip) return refused('badInput')

      montage.clips = montage.clips.filter(one => one !== clip)
      return done
    }

    case 'clip.move': {
      const clip = aimed(montage, input)
      const start = number(input, 'start')
      const track = montage.tracks.find(one => one.id === text(input, 'trackId'))
      if (!clip || start === null || !track) return refused('badInput')

      clip.start = start
      clip.trackId = track.id
      montage.modified = true
      return done
    }

    /**
     * An EDGE and a point on the timeline, which is the studio's own spelling. Trimming the in
     * point eats the head of the source; trimming the out point sets where it ends.
     */
    case 'clip.trim': {
      const clip = aimed(montage, input)
      const edge = text(input, 'edge')
      const at = number(input, 'at')
      if (!clip || at === null || (edge !== 'in' && edge !== 'out')) return refused('badInput')

      if (edge === 'in') {
        const eaten = at - clip.start
        clip.offset += eaten
        clip.duration = Math.max(0, clip.duration - eaten)
        clip.start = at
      } else {
        clip.duration = Math.max(0, at - clip.start)
      }
      montage.modified = true
      return done
    }

    case 'clip.split': {
      const clip = aimed(montage, input)
      const at = number(input, 'at')
      if (!clip || at === null || at <= clip.start || at >= clip.start + clip.duration) {
        return refused('badInput')
      }

      const tail = {
        ...clip,
        id: nextId(bench, 'clip'),
        start: at,
        duration: clip.start + clip.duration - at,
      }
      clip.duration = at - clip.start
      montage.clips.push(tail)
      return answered({ clipId: tail.id })
    }

    case 'clip.gain': {
      const clip = aimed(montage, input)
      const gain = number(input, 'gain')
      if (!clip || gain === null) return refused('badInput')

      clip.gain = gain
      montage.modified = true
      return done
    }

    case 'clip.fade': {
      const clip = aimed(montage, input)
      const edge = text(input, 'edge')
      const length = number(input, 'length')
      if (!clip || length === null || (edge !== 'in' && edge !== 'out')) return refused('badInput')

      if (edge === 'in') clip.fadeIn = length
      else clip.fadeOut = length
      montage.modified = true
      return done
    }

    case 'clip.speed': {
      const clip = aimed(montage, input)
      const speed = number(input, 'speed')
      if (!clip || speed === null) return refused('badInput')

      clip.speed = speed
      return done
    }

    case 'clip.select':
      bench.selection = { kind: 'clip', ids: [text(input, 'clipId')] }
      return done

    default:
      return null
  }
}
