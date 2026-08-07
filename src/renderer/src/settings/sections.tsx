import type { FC } from 'react'
import type { ModelFamily } from '@shared/domain/model'
import type { SettingsSectionId } from '@shared/domain/settings'
import { AccountSettings } from './AccountSettings'
import { AppearanceSettings } from './AppearanceSettings'
import { GenerationSettings } from './GenerationSettings'
import { MediaSettings } from './MediaSettings'
import { ModelFamilySettings } from './ModelFamilySettings'

export type SettingsSection = {
  id: string
  /** i18n key of the label — never the displayed text. */
  labelKey: string
  descriptionKey?: string
  Content: FC
  children?: readonly SettingsSection[]
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
 * The settings tree: a column of sections on the left, the selected one on the right. Adding
 * a screen means adding an entry here — the window itself knows nothing about what it shows.
 *
 * Spec § 9 also lists Storage, Shortcuts, Performance and Advanced. They appear here as they
 * are built; an entry with nothing behind it would be worse than its absence.
 *
 * Top-level ids are the shared `SettingsSectionId`, so a section renamed here immediately
 * fails to compile rather than quietly breaking every `settings.open` that names it.
 */
export const SETTINGS_SECTIONS: readonly (SettingsSection & { id: SettingsSectionId })[] = [
  {
    id: 'account',
    labelKey: 'settings.account',
    descriptionKey: 'settings.accountDescription',
    Content: AccountSettings,
  },
  {
    id: 'appearance',
    labelKey: 'settings.appearance',
    descriptionKey: 'settings.appearanceDescription',
    Content: AppearanceSettings,
  },
  {
    id: 'generation',
    labelKey: 'settings.generation',
    descriptionKey: 'settings.generationDescription',
    Content: GenerationSettings,
    children: WORKSPACE_FAMILIES.map(familySection),
  },
  {
    id: 'media',
    labelKey: 'settings.media',
    descriptionKey: 'settings.mediaDescription',
    Content: MediaSettings,
  },
]

export function findSection(id: string): SettingsSection | null {
  for (const section of SETTINGS_SECTIONS) {
    if (section.id === id) return section
    const child = section.children?.find(candidate => candidate.id === id)
    if (child) return child
  }
  return null
}
