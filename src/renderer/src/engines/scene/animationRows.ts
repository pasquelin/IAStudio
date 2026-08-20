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
import { shotCameras } from './cameraShots'

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
  /**
   * The shots this camera is on air for, when the subject IS a camera the band stacks — absent
   * on every other line, which is what tells the two apart.
   *
   * On the subject's own line rather than a row of its own, because a camera and its shots are
   * one thing to a hand: the line carries the camera's NAME, its bars, and its channels folded
   * underneath. Two rows put the shot at the top of the sheet and the lens halfway down it.
   */
  bars?: readonly ShotBar[]
}

export type ChannelRow = {
  kind: 'channel'
  id: string
  name: string
  height: number
  track: AnimationTrack
}

/**
 * One lane of a subject's track, and the blocks laid along it — Blender's NLA rather than its
 * dope sheet.
 *
 * A lane holds SEVERAL blocks, each with a length, which is why it is a row of its own rather
 * than a channel: what it draws is bars one drags, not diamonds. Lanes stack, and two of them
 * play at once.
 */
export type LaneRow = {
  kind: 'lane'
  id: string
  name: string
  height: number
  nodeId: string
  laneId: string
  /** The last lane of its object offers to add one after it, and it alone: adding is one action. */
  last: boolean
  blocks: readonly ClipBlock[]
}

/** One shot on the band, with the name of the camera it puts on air. */
export type ShotBar = {
  shot: CameraShot
  name: string
}

export type AnimationRow = SubjectRow | ChannelRow | LaneRow

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
  clipId: string
  name: string
  start: Us
  /** How long the block runs on the band, at the speed it plays. */
  duration: Us
}

/** One lane of one model, as the panel hands it over: the document's own lanes, measured. */
export type SheetLane = {
  nodeId: string
  laneId: string
  name: string
  blocks: readonly ClipBlock[]
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

export type RowsOptions = {
  /**
   * The objects on stage — read for their NAMES and to know which still exist, never to decide
   * who gets a line. `timeline.sheet` decides that, and it is what the person put there.
   */
  nodes: readonly SheetNode[]
  /** Which subjects are unfolded. Absent from the set means folded, so a new one arrives folded. */
  expanded: ReadonlySet<string>
  /**
   * The lanes on stage. Their blocks come from the ENGINE, not the timeline: a clip's length
   * lives in the GLB, so nothing that reads only the document can know how long a block runs.
   */
  lanes?: readonly SheetLane[]
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
  const rows: AnimationRow[] = []
  const grouped = new Map<string, AnimationTrack[]>()

  for (const track of timeline.tracks) {
    const key = subjectKey(track.target)
    const found = grouped.get(key)
    if (found) found.push(track)
    else grouped.set(key, [track])
  }

  const named = new Map(options.nodes.map(node => [node.id, node.name]))

  const lanesOfNode = new Map<string, SheetLane[]>()
  for (const lane of options.lanes ?? []) {
    const found = lanesOfNode.get(lane.nodeId)
    if (found) found.push(lane)
    else lanesOfNode.set(lane.nodeId, [lane])
  }

  /** One line, its channels and its lanes, appended in place — wherever the subject stands. */
  const push = (key: string, bars?: readonly ShotBar[]): void => {
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
      bars,
    })

    if (!expanded) return

    for (const track of tracks) {
      rows.push({
        kind: 'channel',
        id: track.id,
        name: track.name,
        height: CHANNEL_HEIGHT,
        track,
      })
    }

    // The lanes of the object come under its channels, INSIDE the same unfolded track: what a
    // subject moves and what it plays belong to one thing, and a run of lanes at the foot of the
    // sheet said the opposite. A bone subject has none — a lane plays a whole rig at once.
    const lanes = lanesOfNode.get(key) ?? []
    for (const [rank, lane] of lanes.entries()) {
      rows.push({
        kind: 'lane',
        id: laneKey(lane.nodeId, lane.laneId),
        name: lane.name,
        height: CHANNEL_HEIGHT,
        nodeId: lane.nodeId,
        laneId: lane.laneId,
        last: rank === lanes.length - 1,
        blocks: lane.blocks,
      })
    }
  }

  // A shot whose camera the scene has lost is left out, as `activeShotAt` leaves it out of the
  // answer: a bar naming nothing would be a line one could drag and never see on screen.
  const onAir = shotCameras(timeline.shots).filter(cameraId => named.has(cameraId))

  // The cameras on air open the sheet, in the order the DOCUMENT holds their shots — that order
  // IS the montage's law, so the eye and `activeShotAt` cannot disagree. Which is also why they
  // are left out of the arrangement below.
  for (const cameraId of onAir) push(cameraId, barsOf(timeline, cameraId, named))

  /*
   * Who gets a line: what the person PUT on the sheet, plus whoever HOLDS a track. A house is
   * scenery and a character in front of it is animated — only the person can say which, and
   * deriving it from the scene put 8 000 blocks and 24 009 buttons on the band, measured 20/08.
   */
  const keyed = [...grouped.values()].flatMap(tracks => tracks[0]?.target.nodeId ?? [])
  // The sheet first, then whoever holds a track. Through a `Set`, which keeps each one at its
  // FIRST place — an object both on the sheet and keyed appears where the sheet put it.
  const shown = [...new Set([...timeline.sheet, ...keyed])].filter(id => named.has(id))
  const isShown = new Set(shown)

  /** The objects first, in the order the sheet holds them, then the bones keyed inside them. */
  const natural = [
    ...shown.filter(id => !onAir.includes(id)),
    // A bone is keyed inside its object, so it rides on the object's own place on the sheet.
    ...[...grouped.entries()]
      .filter(([key, tracks]) => !named.has(key) && isShown.has(tracks[0]?.target.nodeId ?? ''))
      .map(([key]) => key),
  ]

  for (const key of orderedSubjects(natural, options.order ?? [])) push(key)

  return rows
}

/** The bars one camera's line carries, in the order the document lays its shots down. */
function barsOf(
  timeline: AnimationTimeline,
  cameraId: string,
  named: ReadonlyMap<string, string>,
): ShotBar[] {
  const name = named.get(cameraId) ?? cameraId
  return timeline.shots.flatMap(shot => (shot.cameraId === cameraId ? { shot, name } : []))
}

/** How a lane row is named, and what a hit test hands back — one spelling for both. */
export function laneKey(nodeId: string, laneId: string): string {
  return `lane:${nodeId}:${laneId}`
}

/** The row a click lands on, folded or not, so a caller never walks the list a second time. */
export function trackIdsOf(row: AnimationRow): string[] {
  if (row.kind === 'subject') return row.tracks.map(track => track.id)
  if (row.kind === 'channel') return [row.track.id]
  // A lane drives no channel: it plays clips the file brought.
  return []
}
