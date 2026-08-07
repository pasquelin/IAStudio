import { isRecord } from '../guards'
import { DEFAULT_SETTINGS, type PartialSettings, type Settings } from './settings'

/** A value one control can edit. Anything else is a branch, or a screen of its own. */
export type SettingValue = string | number | boolean

/**
 * Branches whose editor is a screen rather than a control per leaf — the default model of a
 * family is picked from a catalogue fetched at runtime, not from a list anyone can write down.
 */
type Dedicated = 'defaultModels'

type Editable<T> = Exclude<keyof T & string, Dedicated>

/**
 * Dotted paths to the leaves of `Settings`, derived rather than listed: a setting added to the
 * type and forgotten in the registry then fails the coverage test instead of quietly having no
 * screen, and a path with a typo stops compiling.
 */
type LeafPaths<T> = {
  [K in Editable<T>]: NonNullable<T[K]> extends SettingValue
    ? K
    : `${K}.${LeafPaths<NonNullable<T[K]>>}`
}[Editable<T>]

export type SettingPath = LeafPaths<Settings>

type Descend<T, P extends string> = P extends `${infer Key}.${infer Rest}`
  ? Key extends keyof T
    ? Descend<NonNullable<T[Key]>, Rest>
    : never
  : P extends keyof T
    ? NonNullable<T[P]>
    : never

/** What a given path holds — so a descriptor cannot offer `3` as a choice of theme. */
export type ValueAt<P extends SettingPath> = Descend<Settings, P>

function isSettingValue(value: unknown): value is SettingValue {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
}

/** Reads one leaf. Absent means the setting is unset, which for an optional path is normal. */
export function valueAt(settings: Settings, path: SettingPath): SettingValue | undefined {
  let current: unknown = settings

  for (const key of path.split('.')) {
    if (!isRecord(current)) return undefined
    current = current[key]
  }

  return isSettingValue(current) ? current : undefined
}

/** What a setting starts at. Read through the path, so no default is ever written twice. */
export function defaultAt(path: SettingPath): SettingValue | undefined {
  return valueAt(DEFAULT_SETTINGS, path)
}

/**
 * A one-leaf write, in the shape the boundary takes. The single place a path becomes a nested
 * object, so the one cast it needs is written once — and what it produces is validated against
 * zod in the main process before anything is stored.
 */
export function partialFor(path: SettingPath, value: SettingValue | undefined): PartialSettings {
  const nested = path.split('.').reduceRight<unknown>((inner, key) => ({ [key]: inner }), value)

  // A runtime string cannot be spelled as a key of `PartialSettings`; `parsePartialSettings`
  // is what actually decides whether this is acceptable.
  return nested as PartialSettings
}
