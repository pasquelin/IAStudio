import type { FC } from 'react'
import type { SettingsSectionId } from '@shared/domain/settings'
import {
  childSections,
  rootSections,
  SETTING_SECTIONS,
  type SettingSectionEntry,
} from '@shared/domain/settings-registry'
import { AccountSettings } from './AccountSettings'
import { DictationSettings } from './DictationSettings'
import { MediaSettings } from './MediaSettings'
import { ShortcutsSettings } from './ShortcutsSettings'
import { ModelFamilySettings } from './ModelFamilySettings'

export type SettingsSection = SettingSectionEntry & {
  /** What no descriptor can express: credentials, a catalogue picker, a resolved status. */
  Content?: FC
  children: readonly SettingsSection[]
}

/**
 * What no descriptor can express, per section. Everything else — the id, the two texts, the
 * nesting — comes from the shared registry.
 *
 * The family screens are spelled out rather than derived from the id: reading `'image'` back
 * out of `'generation.image'` would hand `ModelFamilySettings` a string the type cannot check,
 * and a section renamed would fail here instead of failing silently.
 */
const CONTENT: Partial<Record<SettingsSectionId, FC>> = {
  account: AccountSettings,
  shortcuts: ShortcutsSettings,
  media: MediaSettings,
  dictation: DictationSettings,
  'generation.image': () => <ModelFamilySettings family="image" />,
  'generation.video': () => <ModelFamilySettings family="video" />,
  'generation.3d': () => <ModelFamilySettings family="3d" />,
  'generation.audio': () => <ModelFamilySettings family="audio" />,
  'generation.upscale': () => <ModelFamilySettings family="upscale" />,
  'generation.background-removal': () => <ModelFamilySettings family="background-removal" />,
  'generation.vectorization': () => <ModelFamilySettings family="vectorization" />,
}

function withContent(entry: SettingSectionEntry): SettingsSection {
  return {
    ...entry,
    Content: CONTENT[entry.id],
    children: childSections(entry.id).map(withContent),
  }
}

/**
 * The settings tree: a column of sections on the left, the selected one on the right. The
 * sections, their texts and their nesting all come from the registry — this only adds what
 * belongs to React.
 *
 * Spec § 9 also lists Storage, Shortcuts, Performance and Advanced. They appear as they are
 * built; an entry with nothing behind it would be worse than its absence.
 */
export const SETTINGS_SECTIONS: readonly SettingsSection[] = rootSections().map(withContent)

export function findSection(id: string): SettingsSection | null {
  const entry = SETTING_SECTIONS.find(section => section.id === id)
  return entry ? withContent(entry) : null
}
