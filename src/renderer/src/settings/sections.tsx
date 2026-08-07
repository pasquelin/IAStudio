import type { FC } from 'react'
import type { ModelFamily } from '@shared/domain/model'
import type { SettingSection } from '@shared/domain/settings-registry'
import { AccountSettings } from './AccountSettings'
import { MediaSettings } from './MediaSettings'
import { ModelFamilySettings } from './ModelFamilySettings'

export type SettingsSection = {
  id: string
  /** i18n key of the label — never the displayed text. */
  labelKey: string
  descriptionKey?: string
  /** Settings this screen owns, rendered from the registry. */
  registry?: SettingSection
  /** What no descriptor can express: credentials, a catalogue picker, a resolved status. */
  Content?: FC
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
 * The settings tree: a column of sections on the left, the selected one on the right. What a
 * section shows is mostly `registry` — the settings themselves are declared in
 * `settings-registry.ts`, never written out as a form here.
 *
 * Spec § 9 also lists Storage, Shortcuts, Performance and Advanced. They appear here as they
 * are built; an entry with nothing behind it would be worse than its absence.
 */
export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
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
    registry: 'appearance',
  },
  {
    id: 'generation',
    labelKey: 'settings.generation',
    descriptionKey: 'settings.generationDescription',
    registry: 'generation',
    children: WORKSPACE_FAMILIES.map(familySection),
  },
  {
    id: 'media',
    labelKey: 'settings.media',
    descriptionKey: 'settings.mediaDescription',
    registry: 'media',
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
