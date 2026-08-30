import { CLOUD_IDS } from '@shared/domain/aiCloud'

/**
 * i18n key of what answered a turn — never a hardcoded name.
 *
 * 🛑 `aiClouds.<id>`, which nine sites of the studio already read: written `ai.<id>` the key
 * resolved to nothing, so the journal printed the raw id — « deepseek » where the picker beside
 * it says « DeepSeek », and « anthropic » where everything else says « Claude ».
 */
export const doorLabelKey = (door: string): string =>
  CLOUD_IDS.includes(door) ? `aiClouds.${door}` : 'activity.localDoor'
