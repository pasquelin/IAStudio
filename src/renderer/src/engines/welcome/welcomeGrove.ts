/**
 * Where the welcome's little trees stand, in world units. Plain numbers, like `welcomeMotion`:
 * the walk reads them to steer around, and the builder reads them to place meshes.
 */

/** One tree: a trunk, a crown above it, and the planter it grows out of. */
export type WelcomeTree = {
  x: number
  z: number
  /** Trunk height, crown centre sitting at it. */
  height: number
  crown: number
  /** Half the planter's width. The box is square in plan and a third as tall. */
  planter: number
  /** Yaw, so no two crowns show a reader the same facet. */
  turn: number
}

/**
 * The ground the walk keeps to: an ELLIPSE, wide and shallow.
 *
 * 🛑 Both halves of that shape are the window's, not the world's. The welcome's sheet of copy owns
 * the middle of the frame, so the yard stands BEHIND the camera's mark — where the floor projects
 * above the sheet — and it is stretched sideways because that band is wide and short.
 */
export const WELCOME_YARD_AT = { x: 0, z: -5.5 }

export const WELCOME_YARD = { x: 7, z: 3.2 }

/** How wide a walker is, for the purpose of not clipping a planter. */
const WELCOME_WALKER_WIDTH = 0.42

/**
 * The composition. Four, well apart (Alban): a grove reads as a place, a thicket reads as a wall.
 *
 * Two stand NEAR the camera for depth and two far, and the near pair is pushed out to the sides:
 * the walk owns the middle of the band, and a crown in front of it hides the one thing on screen.
 *
 * 🛑 The near band is left BARE. A crown between the camera and the walker hides the one thing the
 * screen is for, and at this angle a tree three metres nearer covers a walker whole.
 */
export const WELCOME_GROVE: readonly WelcomeTree[] = [
  { x: -8.2, z: 1.4, height: 1.34, crown: 1.02, planter: 0.66, turn: 0.9 },
  { x: 9, z: 0.2, height: 1.22, crown: 0.9, planter: 0.6, turn: 4.8 },
  { x: -4.6, z: -7.8, height: 1.16, crown: 0.86, planter: 0.56, turn: 0.3 },
  { x: 3.8, z: -8.6, height: 1.02, crown: 0.74, planter: 0.5, turn: 2.4 },
]

/**
 * How far out of the yard's middle a spot stands, with one at its rim answering exactly 1 — the
 * ellipse read as a circle, which is the only way a single number says « outside ».
 */
export const welcomeYardOffset = (x: number, z: number): number =>
  Math.hypot((x - WELCOME_YARD_AT.x) / WELCOME_YARD.x, (z - WELCOME_YARD_AT.z) / WELCOME_YARD.z)

/** How far a walker must stay from a tree's centre: its planter, plus their own width. */
export function welcomeClearanceOf(tree: WelcomeTree): number {
  // The planter is square, so its CORNER is what a circle has to clear, not its side.
  return tree.planter * Math.SQRT2 + WELCOME_WALKER_WIDTH
}

/**
 * Whether that spot is walkable: inside the yard, and out of every planter. `slack` is what the
 * look-ahead keeps ON TOP of contact — a clip cannot stop halfway, so a plan that only just fits
 * is a plan that grazes.
 */
export function welcomeGroveAllows(
  trees: readonly WelcomeTree[],
  x: number,
  z: number,
  slack = 0,
): boolean {
  // The slack is a distance in metres, read against the SHORTER half — the edge crossed soonest.
  if (welcomeYardOffset(x, z) > 1 - slack / Math.min(WELCOME_YARD.x, WELCOME_YARD.z)) return false

  return trees.every(tree => Math.hypot(x - tree.x, z - tree.z) >= welcomeClearanceOf(tree) + slack)
}

/**
 * How much of that slack the look-ahead asks for. Wider than any overshoot a clip's arc leaves.
 *
 * 🛑 Exported because a walker STANDING inside it is a walker every look-ahead reads shut on, and
 * the walk has to recognise that spot to leave it — allowed at contact, refused as a starting line.
 */
export const WELCOME_SLACK = 0.35

/**
 * Whether a walker leaving that spot has room for `distance` metres, turning by `turn` as they
 * go. Walked in short steps rather than solved: a swept circle against seven discs and a ring is
 * an equation nobody would reread, and a clip cannot stop halfway through its own arc.
 */
export function welcomeGroveOpens(
  trees: readonly WelcomeTree[],
  from: { x: number; z: number; heading: number },
  distance: number,
  turn = 0,
): boolean {
  const steps = 12
  let { x, z, heading } = from
  for (let step = 0; step < steps; step += 1) {
    // The MID-heading, exactly as `welcomeAdvance` integrates: a walk read one way and predicted
    // the other drifts apart over an arc, and the drift is what steps onto a planter.
    const along = heading + turn / (steps * 2)
    x += (Math.sin(along) * distance) / steps
    z += (Math.cos(along) * distance) / steps
    heading += turn / steps
    if (!welcomeGroveAllows(trees, x, z, WELCOME_SLACK)) return false
  }

  return true
}
