import type { ModelFamily } from '@shared/domain/model'
import type { SettingsSectionId } from '@shared/domain/settings'

/** The manager, whole — where a reading that names no family of its own leads. */
export const AI_SECTION: SettingsSectionId = 'ai'

/**
 * The settings screen a family's models are chosen on, fetched when a click asks for it.
 *
 * 🛑 Deferred rather than imported: `settingsRegistry` is what the settings window rides in on —
 * 48.38 kB on 9 August, preloads counted — and the home sits in the opening chunk, which
 * `eager-graph.test.ts` holds. Composing the id at the call site is the other way, and wrong.
 */
export async function aiSectionOf(family: ModelFamily | null): Promise<SettingsSectionId> {
  if (family === null) return AI_SECTION

  const { sectionOfFamily } = await import('@shared/domain/settingsRegistry')

  return sectionOfFamily(family) ?? AI_SECTION
}
