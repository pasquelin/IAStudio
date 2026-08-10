import { toDegrees } from '@shared/domain/angles'
import { handleDirection, type CornerId, type HandleId } from './handles'

/**
 * What the pointer becomes over a transform box.
 *
 * Both read the grip's **nominal** direction — where it pulls on an untouched box — then mirror
 * it and turn it as the layer is. Taking the angle from the middle of the box instead would
 * answer a different question: on a 1024×256 layer the north-east corner sits fourteen degrees
 * off the horizontal, and the arrow would promise a one-axis pull on a grip that resizes both.
 *
 * Only the *sign* of each scale is read, never its size — that is exactly the difference between
 * mirroring the direction and letting the box's proportions bend it.
 */
export type Facing = { rotation: number; scaleX: number; scaleY: number }

/** A frame that was never touched — what the crop frame, which cannot turn, is shown with. */
export const UPRIGHT: Facing = { rotation: 0, scaleX: 1, scaleY: 1 }

/** Degrees of a grip's direction once the layer's mirroring and rotation are applied, in [0, 360). */
function facing(handle: HandleId, of: Facing): number {
  const direction = handleDirection(handle)
  const x = direction.x * Math.sign(of.scaleX || 1)
  const y = direction.y * Math.sign(of.scaleY || 1)
  const degrees = toDegrees(Math.atan2(y, x) + of.rotation)
  return ((degrees % 360) + 360) % 360
}

/**
 * The native resize cursor closest to the direction the grip pulls in. Four keywords rather than
 * eight cases: pulling north-east and south-west are the same gesture, so the table has period
 * 180 and saying so keeps its two halves from drifting apart.
 */
export function resizeCursor(handle: HandleId, of: Facing): string {
  const angle = facing(handle, of) % 180

  if (angle < 22.5 || angle >= 157.5) return 'ew-resize'
  if (angle < 67.5) return 'nwse-resize'
  if (angle < 112.5) return 'ns-resize'
  return 'nesw-resize'
}

/**
 * No platform ships a rotation cursor, so it is drawn: a curved arrow, turned to the tangent of
 * the circle the grip would sweep. Quantised to fifteen degrees — the eye cannot tell a finer
 * step apart, and it bounds the cache to twenty-four entries for a session.
 */
const ROTATE_STEP = 15

const drawn = new Map<number, string>()

export function rotateCursor(corner: CornerId, of: Facing): string {
  // The arrow shows where the hand would travel, which is across the radius, not along it.
  const tangent = facing(corner, of) + 90
  // Folded back into a turn, so a tangent past 360° shares the image its angle already has.
  const step = (Math.round(tangent / ROTATE_STEP) * ROTATE_STEP) % 360

  const cached = drawn.get(step)
  if (cached !== undefined) return cached

  const built = rotateSvg(step)
  drawn.set(step, built)
  return built
}

/**
 * White on a dark outline, so it stays visible on either — the same reasoning as the drawn tool
 * cursors in `image-tools`. `pointer` is the fallback for a platform that refuses an image cursor
 * rather than leaving none at all.
 */
function rotateSvg(degrees: number): string {
  const arrow =
    `<g transform="rotate(${degrees} 12 12)">` +
    `<path d="M5 12a7 7 0 0 1 14 0" fill="none" stroke="#000" stroke-width="4"/>` +
    `<path d="M15 12h8l-4 5.5z" fill="#000" stroke="#000" stroke-width="2.5" stroke-linejoin="round"/>` +
    `<path d="M5 12a7 7 0 0 1 14 0" fill="none" stroke="#fff" stroke-width="2"/>` +
    `<path d="M15 12h8l-4 5.5z" fill="#fff"/>` +
    `</g>`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">${arrow}</svg>`

  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") 12 12, pointer`
}
