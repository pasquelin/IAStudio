/**
 * The rows a scene's animation shows, the way a dope sheet lays them out: one line per SUBJECT —
 * an object, or one bone of a rig — and its channels folded underneath.
 *
 * The document holds none of this. It holds tracks, one per property, and that is the right shape
 * to evaluate: what a subject line adds is a way to READ them, which is why it is derived here
 * rather than stored. Folding a subject away must never lose a key.
 */
import type { AnimationTimeline, AnimationTrack, CameraShot } from '@shared/domain/animation'
import { reconcileOrder } from '@shared/domain/order'
import type { Us } from '@shared/domain/time'
import { ROW_PADDING } from '../timeline/timelineGeometry'

/** One object, or one bone of one object. Its channels are the tracks that drive it. */
export type Subject = {
  nodeId: string
  bone?: string
}

export type SubjectRow = {
  kind: 'subject'
  /** Stable across a fold, and what the expanded set holds — see `subjectKey`. */
  id: string
  name: string
  height: number
  expanded: boolean
  /** Every key of every channel, merged and deduplicated: what the folded line shows. */
  keys: readonly Us[]
  tracks: readonly AnimationTrack[]
}

export type ChannelRow = {
  kind: 'channel'
  id: string
  name: string
  height: number
  track: AnimationTrack
}

/**
 * A clip a model brought, as a block on the band — Blender's NLA rather than its dope sheet.
 *
 * It has a LENGTH, unlike a key, which is why it is a row of its own rather than a channel: what
 * it draws is a bar one drags, not a diamond.
 */
export type ClipRow = {
  kind: 'clip'
  id: string
  name: string
  height: number
  nodeId: string
  /** Which of the model's blocks this line draws — a node may hold several. */
  clipId: string
  start: Us
  /** How long the block runs on the band, at the speed it plays. */
  duration: Us
}

/** One shot on the band, with the name of the camera it puts on air. */
export type ShotBar = {
  shot: CameraShot
  name: string
}

/**
 * One LAYER of shots, top to bottom, highest first — the stack `activeShotAt` reads.
 *
 * A row per layer rather than per shot, because the layer is what settles an overlap: two bars on
 * one line are two shots of equal standing, and a bar on the line above wins over both. Shown
 * that way, the rule is visible instead of being something one has to remember.
 */
export type ShotRow = {
  kind: 'shot'
  id: string
  height: number
  layer: number
  bars: readonly ShotBar[]
}

export type AnimationRow = SubjectRow | ChannelRow | ClipRow | ShotRow

/** A block is a bar hung under its subject, so it wants the room a bar reads in and no more. */
export const CLIP_HEIGHT = 24

/**
 * Row heights, in pixels, and they are DERIVED from what the header column must hold rather
 * than chosen: a name on one line, then a row of `--sc-control` buttons under it, plus padding.
 *
 * This is the arithmetic the old panel got wrong in the other direction — it laid six buttons
 * BESIDE a name in a 140 px column, leaving the name zero pixels wide. A height that cannot
 * hold its own controls is the same defect turned ninety degrees.
 *
 * Fixed rather than read from the density gauge because the canvas cannot read a CSS variable;
 * both densities (24 px and 28 px controls) fit inside these.
 */
const CONTROL_ROW = 28
const NAME_ROW = 16

export const SUBJECT_HEIGHT = NAME_ROW + CONTROL_ROW + ROW_PADDING

/** A channel shows a name and one button, side by side — so one control row is enough. */
export const CHANNEL_HEIGHT = CONTROL_ROW + ROW_PADDING

/**
 * Which subject a track belongs to. A bone is addressed by name because it lives inside the
 * file, so the pair is what identifies a line — see `TrackTarget`.
 */
export function subjectKey(subject: Subject): string {
  return subject.bone ? `${subject.nodeId}/${subject.bone}` : subject.nodeId
}

/** Every instant any of these tracks holds a key at, once each, in order. */
export function mergedKeys(tracks: readonly AnimationTrack[]): Us[] {
  const times = new Set<Us>()
  for (const track of tracks) {
    for (const key of track.keys) times.add(key.time)
  }
  return [...times].sort((left, right) => left - right)
}

/** A model playing a clip, as the document holds it and the engine measured it. */
export type ClipBlock = {
  nodeId: string
  clipId: string
  name: string
  start: Us
  duration: Us
}

/** An object of the scene, as the sheet needs to name a line for it. */
export type SheetNode = {
  id: string
  name: string
}

/**
 * The subjects in the order the sheet shows them: the arrangement the user made first, then
 * whatever the scene has added since, in the order the scene holds it.
 *
 * The arrangement is a WAY OF WORKING and nothing else — objects one returns to are brought to
 * the top. It never touches the scene: the outliner keeps its own order, and an object moved here
 * stays exactly where the hierarchy put it.
 */
export function orderedSubjects(
  natural: readonly string[],
  preferred: readonly string[],
): string[] {
  const known = new Set(natural)
  // `reconcileOrder` rather than appending the newcomers at the end, and the difference is what
  // one SEES: an object added to the scene lands under the neighbours the hierarchy already gives
  // it, instead of at the bottom of a sheet somebody has arranged. Its header says as much — this
  // reconciliation had already been written twice before it was named.
  return reconcileOrder(
    preferred.filter(id => known.has(id)),
    natural,
    id => id,
  )
}

/**
 * The same list with one entry moved by that many places. Clamped at both ends rather than
 * wrapping: a row dragged past the top has arrived, it has not gone to the bottom.
 */
export function movedWithin(ids: readonly string[], id: string, by: number): readonly string[] {
  const from = ids.indexOf(id)
  if (from === -1 || by === 0) return ids

  const to = Math.min(Math.max(from + by, 0), ids.length - 1)
  // The SAME array back when nothing moved — a line dragged against the top is asked to move on
  // every step of the gesture, and a fresh array each time rebuilds the whole sheet for nothing.
  if (to === from) return ids

  const moved = [...ids]
  moved.splice(from, 1)
  moved.splice(to, 0, id)
  return moved
}

export type RowsOptions = {
  /**
   * The objects on stage, in outliner order. EVERY one gets a line, keyed or not: a scene's
   * objects already exist, so a band that showed only those with a track made a person create
   * something before they could see anything — which is the whole reason the old panel read as
   * empty while a cube stood in the viewport.
   */
  nodes: readonly SheetNode[]
  /** Which subjects are unfolded. Absent from the set means folded, so a new one arrives folded. */
  expanded: ReadonlySet<string>
  /**
   * The clips on stage. They come from the ENGINE, not the timeline: a clip's length lives in the
   * GLB, so nothing that reads only the document can know how long a block runs.
   */
  clips?: readonly ClipBlock[]
  /** How the user has arranged the lines. Empty leaves the scene's own order — see `orderedSubjects`. */
  order?: readonly string[]
}

/**
 * The rows to draw, top to bottom.
 *
 * Subjects come in the order their first track does, so adding a track to an object already on
 * screen never makes the rows jump — the alternative, sorting by name, reorders the whole sheet
 * the moment an object is renamed.
 */
export function animationRows(timeline: AnimationTimeline, options: RowsOptions): AnimationRow[] {
  const rows: AnimationRow[] = [...shotRows(timeline, options.nodes)]
  const grouped = new Map<string, AnimationTrack[]>()

  for (const track of timeline.tracks) {
    const key = subjectKey(track.target)
    const found = grouped.get(key)
    if (found) found.push(track)
    else grouped.set(key, [track])
  }

  const named = new Map(options.nodes.map(node => [node.id, node.name]))

  /** The objects first, in the order the scene holds them, then the bones keyed inside them. */
  const natural = [
    ...options.nodes.map(node => node.id),
    ...[...grouped.keys()].filter(key => !named.has(key)),
  ]
  const order = orderedSubjects(natural, options.order ?? [])

  for (const key of order) {
    const tracks = grouped.get(key) ?? []
    const bone = tracks[0]?.target.bone
    const plain = named.get(bone ? (tracks[0]?.target.nodeId ?? key) : key) ?? key

    const expanded = options.expanded.has(key)

    rows.push({
      kind: 'subject',
      id: key,
      name: bone ? `${plain} · ${bone}` : plain,
      height: SUBJECT_HEIGHT,
      expanded,
      keys: mergedKeys(tracks),
      tracks,
    })

    if (!expanded) continue

    for (const track of tracks) {
      rows.push({
        kind: 'channel',
        id: track.id,
        name: track.name,
        height: CHANNEL_HEIGHT,
        track,
      })
    }
  }

  // Clips come after the keyed subjects, in one run: a block is a different kind of thing from a
  // key, and interleaving the two would make the sheet read as though a clip had channels.
  for (const clip of options.clips ?? []) {
    rows.push({
      kind: 'clip',
      id: `clip:${clip.nodeId}:${clip.clipId}`,
      name: clip.name,
      height: CLIP_HEIGHT,
      nodeId: clip.nodeId,
      clipId: clip.clipId,
      start: clip.start,
      duration: clip.duration,
    })
  }

  return rows
}

/**
 * The shot lines, highest layer first — the order `activeShotAt` settles an overlap in, drawn
 * top to bottom so the picture and the rule agree.
 *
 * Above the subjects, and in one run: a shot is a different kind of thing from a key, and it is
 * what the whole sequence is read from.
 */
function shotRows(timeline: AnimationTimeline, nodes: readonly SheetNode[]): ShotRow[] {
  if (timeline.shots.length === 0) return []

  const named = new Map(nodes.map(node => [node.id, node.name]))
  const layers = new Map<number, ShotBar[]>()

  for (const shot of timeline.shots) {
    // A shot whose camera is gone is left out, as `activeShotAt` leaves it out of the answer:
    // a bar naming nothing would be a line one could drag and never see on screen.
    const name = named.get(shot.cameraId)
    if (name === undefined) continue

    const bars = layers.get(shot.layer)
    if (bars) bars.push({ shot, name })
    else layers.set(shot.layer, [{ shot, name }])
  }

  return [...layers.entries()]
    .sort(([left], [right]) => right - left)
    .map(([layer, bars]) => ({
      kind: 'shot',
      id: `shots:${layer}`,
      // A track of the band, at the height the others stand: a line half as tall as the ones
      // under it reads as a strip stuck above the sheet rather than as one of its tracks.
      height: SUBJECT_HEIGHT,
      layer,
      bars,
    }))
}

/** The row a click lands on, folded or not, so a caller never walks the list a second time. */
export function trackIdsOf(row: AnimationRow): string[] {
  if (row.kind === 'subject') return row.tracks.map(track => track.id)
  if (row.kind === 'channel') return [row.track.id]
  // Neither a block nor a shot drives a channel: one plays a clip the file brought, the other
  // says which camera is on air.
  return []
}
