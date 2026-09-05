import { isRecord } from '../guards'

/** Bump when a new first-launch slide must be shown to people who already finished an older one. */
export const WELCOME_VERSION = 1

export const WELCOME_ROUTE = 'welcome'

export function isWelcomeRoute(hash: string): boolean {
  return hash.replace(/^#/, '') === WELCOME_ROUTE
}

export type WelcomeSlideId = 'language' | 'look' | 'craft' | 'account' | 'project'

/**
 * A greeting slide opened this list until Alban dropped it: the masthead spells the product's name
 * above every step, so a screen whose whole content was that name again said nothing.
 */
export const WELCOME_SLIDES: readonly WelcomeSlideId[] = [
  'language',
  'look',
  'craft',
  'account',
  'project',
]

export type OnboardingSettings = {
  version: number
  /** ISO 8601. Absent means the welcome has never been finished or skipped. */
  completedAt?: string
}

export const DEFAULT_ONBOARDING: OnboardingSettings = { version: 0 }

export function needsWelcome(onboarding: OnboardingSettings): boolean {
  if (!onboarding.completedAt) return true
  return onboarding.version < WELCOME_VERSION
}

export function completedOnboarding(now: string): OnboardingSettings {
  return { version: WELCOME_VERSION, completedAt: now }
}

/**
 * An existing settings file with no onboarding stamp is a studio that already ran, not a first
 * launch. Completing it here is what keeps the welcome from ambushing everyone on the day it ships.
 */
export function grandfatherOnboarding(stored: object, now: string): OnboardingSettings | undefined {
  if (Object.keys(stored).length === 0) return undefined
  const onboarding = isRecord(stored) && isRecord(stored.onboarding) ? stored.onboarding : undefined
  if (typeof onboarding?.completedAt === 'string' && onboarding.completedAt !== '') return undefined
  return completedOnboarding(now)
}
