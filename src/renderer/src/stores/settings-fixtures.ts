import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import type { ModelFamily } from '@shared/domain/model'
import { useSettings } from './settings'

/**
 * The preferred model of each family, for a test that needs one — or none at all, called with
 * nothing.
 *
 * From `DEFAULT_SETTINGS` rather than from whatever the store holds: four test files wrote this
 * by hand under three names, and they did not all reset the same thing, so what a test inherited
 * depended on the file it sat in.
 */
export function preferModels(defaultModels: Partial<Record<ModelFamily, string>> = {}): void {
  useSettings.setState({
    settings: {
      ...DEFAULT_SETTINGS,
      generation: { ...DEFAULT_SETTINGS.generation, defaultModels },
    },
  })
}
