import { COMMAND_REGISTRY, type CommandDescriptor } from './command'
import type { SettingsSectionId } from './settings'
import {
  ACTION_REGISTRY,
  SETTING_REGISTRY,
  SETTING_SECTIONS,
  type SettingAction,
  type SettingDescriptor,
} from './settings-registry'

/**
 * What the search box can find. Three registries rather than one: a settings window that only
 * finds its own sliders sends people hunting through tabs for the shortcut or the button they
 * came for.
 */
export type SearchHit =
  | { kind: 'setting'; section: SettingsSectionId; descriptor: SettingDescriptor }
  | { kind: 'action'; section: SettingsSectionId; action: SettingAction }
  | { kind: 'command'; section: SettingsSectionId; command: CommandDescriptor }

/**
 * Accents dropped and case folded, so "thème" is found by typing `theme` — a search box that
 * demands a circumflex is a search box nobody uses.
 */
function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

export type Translate = (key: string) => string

/**
 * Searched over what is on screen — title and description — rather than over paths and ids,
 * which the user never sees. `translate` is injected because `shared/` carries no i18n runtime.
 */
export function matchSettings(query: string, translate: Translate): readonly SearchHit[] {
  const needle = fold(query.trim())
  if (needle === '') return []

  const matches = (...keys: string[]): boolean =>
    fold(keys.map(translate).join(' ')).includes(needle)

  return [
    ...SETTING_REGISTRY.filter(entry => matches(entry.titleKey, entry.helpKey)).map(
      (descriptor): SearchHit => ({ kind: 'setting', section: descriptor.section, descriptor }),
    ),
    ...ACTION_REGISTRY.filter(entry => matches(entry.titleKey, entry.helpKey)).map(
      (action): SearchHit => ({ kind: 'action', section: action.section, action }),
    ),
    // Commands all belong to the shortcuts screen, whatever surface they act on: that is where
    // one goes to do anything about them.
    ...COMMAND_REGISTRY.filter(entry => matches(entry.titleKey, entry.helpKey)).map(
      (command): SearchHit => ({ kind: 'command', section: 'shortcuts', command }),
    ),
  ]
}

/** The sections a result set touches, in the order the navigation lists them. */
export function sectionsOf(hits: readonly SearchHit[]): readonly SettingsSectionId[] {
  const found = new Set(hits.map(hit => hit.section))
  return SETTING_SECTIONS.filter(section => found.has(section.id)).map(section => section.id)
}
