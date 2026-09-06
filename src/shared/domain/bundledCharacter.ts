import { CHARACTER_LEVELS, type CharacterLevel } from './characterLevel'

/**
 * The character the app ships with, at each density it ships at.
 *
 * One skeleton across all four — the studio's own humanoid roles, which is what lets the shipped
 * clips play on it without a guess, and what a character somebody imports is measured against.
 */
export const BUNDLED_CHARACTER_NAMES: Record<CharacterLevel, string> = {
  low: 'HeroLow',
  medium: 'HeroMedium',
  high: 'HeroHigh',
  ultra: 'HeroUltra',
}

/**
 * Every level the app ships — all four, which is the case a character imported by hand rarely is.
 * Read through `nearestCharacterLevel` like any other character's, never indexed directly.
 */
export const BUNDLED_CHARACTER_LEVELS: readonly CharacterLevel[] = CHARACTER_LEVELS

export function bundledCharacterFile(level: CharacterLevel): string {
  return `${BUNDLED_CHARACTER_NAMES[level]}.glb`
}

/** What one of them lands in the project as: the level it stands for, and the row it now has. */
export type InstalledCharacter = { level: CharacterLevel; assetId: string }
