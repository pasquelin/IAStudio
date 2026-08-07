import type { FC } from 'react'
import type { ModelFamily } from '@shared/domain/model'
import type { SettingsSectionId } from '@shared/domain/settings'
import { SETTING_SECTIONS } from '@shared/domain/settings-registry'
import { AccountSettings } from './AccountSettings'
import { MediaSettings } from './MediaSettings'
import { ModelFamilySettings } from './ModelFamilySettings'

export type SettingsSection = {
  id: string
  /** i18n key of the label — never the displayed text. */
  labelKey: string
  descriptionKey?: string
  /** Settings this screen owns, rendered from the registry. */
  registry?: SettingsSectionId
  /** What no descriptor can express: credentials, a catalogue picker, a resolved status. */
  Content?: FC
  children?: readonly SettingsSection[]
}

/** What no descriptor can express, per section. Everything else comes from the registry. */
const CONTENT: Partial<Record<SettingsSectionId, FC>> = {
  account: AccountSettings,
  media: MediaSettings,
}

/** Families with a workspace of their own; their label is the workspace's. */
const WORKSPACE_FAMILIES: readonly { family: ModelFamily; labelKey: string }[] = [
  { family: 'image', labelKey: 'workspaces.image' },
  { family: 'video', labelKey: 'workspaces.video' },
  { family: '3d', labelKey: 'workspaces.3d' },
  { family: 'audio', labelKey: 'workspaces.audio' },
  { family: 'upscale', labelKey: 'settings.familyUpscale' },
]

function familySection({ family, labelKey }: { family: ModelFamily; labelKey: string }) {
  return {
    id: `generation.${family}`,
    labelKey,
    Content: () => <ModelFamilySettings family={family} />,
  }
}

/**
 * The settings tree: a column of sections on the left, the selected one on the right. The
 * sections and their texts come from the registry — this only adds what belongs to React: the
 * screens no descriptor can express, and the per-family children.
 *
 * Spec § 9 also lists Storage, Shortcuts, Performance and Advanced. They appear here as they
 * are built; an entry with nothing behind it would be worse than its absence.
 *
 * Top-level ids are the shared `SettingsSectionId`, so a section renamed here immediately
 * fails to compile rather than quietly breaking every `settings.open` that names it.
 */
export const SETTINGS_SECTIONS: readonly (SettingsSection & { id: SettingsSectionId })[] =
  SETTING_SECTIONS.map(section => ({
    id: section.id,
    labelKey: section.labelKey,
    descriptionKey: section.descriptionKey,
    registry: section.id,
    Content: CONTENT[section.id],
    ...(section.id === 'generation' ? { children: WORKSPACE_FAMILIES.map(familySection) } : {}),
  }))

export function findSection(id: string): SettingsSection | null {
  for (const section of SETTINGS_SECTIONS) {
    if (section.id === id) return section
    const child = section.children?.find(candidate => candidate.id === id)
    if (child) return child
  }
  return null
}
