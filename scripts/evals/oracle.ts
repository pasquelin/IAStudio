import { isRecord } from '@shared/guards'
import type { FakeStudio } from './fakeStudio'
import type { Clip, Layer, SceneNode, StudioDocument } from './bench'
import type { Run } from './run'

/**
 * How an oracle reads the studio, and it reads the studio ONLY.
 *
 * 🛑 Never the words the model wrote: every failure this bench exists for was announced as a
 * success by the model itself. `said` is read for one thing alone — whether a question was put
 * back to the person — and never as evidence that something was done.
 */

export const documents = (run: Run): readonly StudioDocument[] => run.studio.documents()

export const inSpace = (run: Run, space: string): readonly StudioDocument[] =>
  documents(run).filter(one => one.space === space)

export const titled = (run: Run, title: string): StudioDocument | undefined =>
  documents(run).find(one => one.title.toLowerCase().includes(title.toLowerCase()))

export const openedFile = (run: Run, ending: string): boolean =>
  documents(run).some(one => (one.path ?? one.title).endsWith(ending))

export const front = (run: Run): StudioDocument | null => run.studio.front()

export const nodes = (run: Run): readonly SceneNode[] =>
  inSpace(run, '3d').flatMap(one => one.nodes)

export const nodeNamed = (run: Run, name: string): SceneNode | undefined =>
  nodes(run).find(one => one.name.toLowerCase().includes(name.toLowerCase()))

export const nodesOfKind = (run: Run, ...kinds: string[]): readonly SceneNode[] =>
  nodes(run).filter(one => kinds.includes(one.kind))

export const layers = (run: Run): readonly Layer[] =>
  inSpace(run, 'image').flatMap(one => one.layers)

export const layerNamed = (run: Run, name: string): Layer | undefined =>
  layers(run).find(one => one.name.toLowerCase().includes(name.toLowerCase()))

export const clips = (run: Run): readonly Clip[] =>
  documents(run).flatMap(one => (one.space === 'video' || one.space === 'audio' ? one.clips : []))

export const files = (run: Run): readonly string[] => run.studio.bench().files.map(one => one.path)

export const holds = (run: Run, path: string): boolean => files(run).includes(path)

export const assets = (run: Run) => run.studio.bench().assets

export const jobs = (run: Run) => run.studio.bench().jobs

/** Whether a generation ran at all, which is what every section-20 scenario turns on. */
export const generated = (run: Run, family?: string): boolean =>
  jobs(run).some(one => one.status === 'success' && (family === undefined || one.family === family))

/** Whether a generation was given a picture to work FROM — "use it as a reference". */
export const referenced = (run: Run, assetId: string): boolean =>
  jobs(run).some(one => one.references.includes(assetId))

/** Roughly equal, because a model answering 2 m as 2.0 has answered. */
export const near = (value: number, wanted: number, slack = 0.001): boolean =>
  Math.abs(value - wanted) <= slack

/** What a read-only turn is allowed to do: look, and say. Nothing that outlives the looking. */
export const changedNothing = (run: Run): boolean =>
  documents(run).every(one => !one.modified) && run.studio.bench().past.length === 0

/** What the model answered a question WITH — a sentence, not an empty turn. */
export const spoke = (run: Run): boolean => run.said.trim().length > 0

export const askedBack = (run: Run): boolean => /\?/.test(run.said)

/** The id `assets.search` would hand back for a file, so a decor can name one. */
export const assetOf = (studio: FakeStudio, ending: string): string =>
  studio.bench().assets.find(one => (one.path ?? '').endsWith(ending))?.id ?? ''

/** The data an action answered, for the rare oracle that must read a reply rather than a state. */
export const answeredWith = (run: Run, action: string): boolean =>
  run.called.some((one, at) => one.action === action && !run.answers[at]?.startsWith('refused'))

/** One second of montage, in the microseconds the state holds. */
export const SECOND = 1_000_000

/** Roughly this many seconds, read off a value the montage keeps in microseconds. */
export const lasts = (value: number, seconds: number): boolean =>
  near(value, seconds * SECOND, SECOND / 100)

/**
 * A gain the person named as a percentage, in the DECIBELS the state holds — `20·log₁₀`. Half
 * volume is −6 dB and not 0.5, and a bench reading fractions passed the wrong answer.
 */
export const quietedTo = (value: number, percent: number): boolean =>
  near(value, 20 * Math.log10(percent / 100), 0.6)

/** Every key of every animation of the open 3D scenes, which nine oracles read. */
export const keys = (run: Run) =>
  inSpace(run, '3d').flatMap(one => one.animations.flatMap(each => each.keys))

/** The audio track of the montage in front, which seven oracles reach for. */
export const audioTrack = (run: Run): string | undefined =>
  documents(run)
    .flatMap(one => one.tracks)
    .find(one => one.kind === 'audio')?.id

/**
 * Whether a camera is placed to frame something: aimed at it, or moved off the origin. Named
 * when the sentence names one, and otherwise the first camera there is — the model chose it.
 */
export const framing = (run: Run, name?: string): boolean => {
  const camera = name === undefined ? nodesOfKind(run, 'camera')[0] : nodeNamed(run, name)
  return camera !== undefined && (camera.targetId !== null || camera.position.z !== 0)
}

/**
 * Whether a settings write named a section AND a key of it. The grid and the shadows have no
 * action of their own, so this is the only road — and « any settings.write » would pass on one
 * about something else entirely.
 */
export const wrote = (run: Run, section: string, key: string): boolean =>
  run.called.some(one => {
    if (one.action !== 'settings.write') return false

    const asked = one.input['settings']
    const written = isRecord(asked) ? asked[section] : undefined
    return isRecord(written) && Object.keys(written).some(name => name.toLowerCase().includes(key))
  })

/** Whether a search was actually run, and on a word the sentence carries. */
export const searched = (run: Run, word: string): boolean =>
  run.called.some(
    one =>
      (one.action === 'files.search' || one.action === 'assets.search') &&
      Object.values(one.input).some(
        value => typeof value === 'string' && value.toLowerCase().includes(word),
      ),
  )
