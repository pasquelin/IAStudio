/** A point of the welcome scene, in world units. Plain numbers so the arithmetic is testable. */
export type WelcomePoint = { x: number; y: number; z: number }

export type WelcomePose = { eye: WelcomePoint; target: WelcomePoint }

/**
 * The camera ORBITS this point, which stands below the eye: a level camera renders a band of
 * nothing where the floor has to read as a viewport.
 */
export const WELCOME_TARGET: WelcomePoint = { x: 0, y: 1.15, z: 0 }

export const WELCOME_HEIGHT = 2.6

export const WELCOME_RADIUS = 8.6

/**
 * How far the viewpoint swings for ONE carousel step, in radians — about seven degrees. Sliding
 * the eye sideways by a unit instead was invisible.
 */
export const WELCOME_SWING = 0.13

/** How fast it settles there. A slide crosses in 280 ms; the swing lands just after. */
export const WELCOME_SWING_RATE = 2.6

/** The envelope of the idle drift, on the radius and on the height. */
export const WELCOME_DRIFT = 0.32

/** The idle drift of the angle itself, in radians. What keeps a still frame from being a photo. */
export const WELCOME_DRIFT_ANGLE = 0.045

export function welcomeAzimuth(slide: number): number {
  return slide * WELCOME_SWING
}

/**
 * How far the hero turns for one step. Big on purpose: the idle spin is a mood a reader never
 * notices, and a slide change has to be SEEN as one.
 */
export const WELCOME_TURN_PER_SLIDE = 1.15

export const WELCOME_TURN_RATE = 3.2

export function welcomeHeroTurn(slide: number): number {
  return slide * WELCOME_TURN_PER_SLIDE
}

/**
 * The camera for a moment of the welcome. `elapsed` is the idle drift and arrives frozen when
 * motion is reduced. The target never moves: tipping it tips the horizon, which is what says 3D.
 */
export function welcomePose(elapsed: number, azimuth: number): WelcomePose {
  const angle = azimuth + Math.sin(elapsed * 0.09) * WELCOME_DRIFT_ANGLE
  const radius = WELCOME_RADIUS + Math.cos(elapsed * 0.07) * WELCOME_DRIFT
  return {
    eye: {
      x: Math.sin(angle) * radius,
      y: WELCOME_HEIGHT + Math.sin(elapsed * 0.06) * WELCOME_DRIFT * 0.4,
      z: Math.cos(angle) * radius,
    },
    target: WELCOME_TARGET,
  }
}

/**
 * An exponential approach, and the elapsed SECONDS are a parameter rather than a per-frame
 * fraction: the same sweep then takes the same time on a 60 Hz panel and on a 120 Hz one.
 */
export function approach(current: number, target: number, seconds: number, rate: number): number {
  return target + (current - target) * Math.exp(-rate * seconds)
}
