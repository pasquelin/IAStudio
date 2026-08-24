import type { TFunction } from 'i18next'
import type { ModelSummary } from '@shared/domain/model'

/**
 * Standing plus a line. Rating, generation time and category come back empty on all 642 public
 * models — measured. A catalogue description replaces origin; "featured" still prefixes it.
 *
 * Its own module so the composition is testable without a render — the row that calls it is
 * memoised, so this runs only when a row's props actually move.
 */
export function modelSubtitle(model: ModelSummary, t: TFunction): string {
  if (model.description) {
    if (!model.featured) return model.description
    return `${t('models.featured')} · ${model.description}`
  }

  let standing: string
  if (model.featured) standing = t('models.featured')
  else if (model.origin === 'official') standing = t('models.official')
  else standing = t('models.community')

  const [capability] = model.capabilities
  // An unknown capability shows its API name rather than its missing translation key.
  if (!capability) return standing
  return `${standing} · ${t(`capabilities.${capability}`, { defaultValue: capability })}`
}
