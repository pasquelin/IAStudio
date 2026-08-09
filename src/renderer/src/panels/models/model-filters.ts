import {
  CAPABILITIES_BY_FAMILY,
  MODEL_ORIGINS,
  MODEL_PERIODS,
  MODEL_SORTS,
  PUBLISHERS_BY_FAMILY,
  TAGS_BY_FAMILY,
  type ModelFamily,
  type ModelPeriod,
  type ModelQuery,
  type ModelSort,
} from '@shared/domain/model'
import {
  selectedValues,
  type CollectionState,
  type FacetDescriptor,
} from '@/helpers/collection-state'

export const ORIGIN_FACET = 'origin'
export const CAPABILITY_FACET = 'capability'
export const TAG_FACET = 'tag'
export const PUBLISHER_FACET = 'publisher'
export const PERIOD_FACET = 'period'

/** Translates a key into user text. Taking it as an argument keeps this module renderless. */
type Translate = (key: string) => string

/** A family's own vocabulary — nothing where a surface browses every family at once. */
function ownedBy(
  table: Record<ModelFamily, readonly string[]>,
  family: ModelFamily | null,
): readonly string[] {
  return family ? table[family] : []
}

/**
 * The facets the API can actually answer. Category, author, rating and generation time are
 * absent on purpose: measured over the 642 public models, `class`, `performanceStats` and the
 * author name come back empty on every single one — a filter for them would filter nothing.
 */
export function facetsFor(family: ModelFamily | null, t: Translate): FacetDescriptor[] {
  const facets: FacetDescriptor[] = [
    {
      key: ORIGIN_FACET,
      label: t('models.origin'),
      options: [
        { value: 'official', label: t('models.official') },
        { value: 'community', label: t('models.community') },
      ],
    },
  ]

  const capabilities = ownedBy(CAPABILITIES_BY_FAMILY, family)
  if (capabilities.length) {
    facets.push({
      key: CAPABILITY_FACET,
      label: t('models.capability'),
      options: capabilities.map(value => ({ value, label: t(`capabilities.${value}`) })),
    })
  }

  const tags = ownedBy(TAGS_BY_FAMILY, family)
  if (tags.length) {
    // Tags are the publishers' own words — untranslated on purpose, and matched as written.
    facets.push({
      key: TAG_FACET,
      label: t('models.tag'),
      options: tags.map(value => ({ value, label: value })),
    })
  }

  // The publisher is a tag like any other, so both facets narrow through the same parameter.
  const publishers = ownedBy(PUBLISHERS_BY_FAMILY, family)
  if (publishers.length) {
    facets.push({
      key: PUBLISHER_FACET,
      label: t('models.publisher'),
      options: publishers.map(value => ({ value, label: value })),
    })
  }

  facets.push({
    key: PERIOD_FACET,
    label: t('models.period'),
    options: MODEL_PERIODS.map(value => ({ value, label: t(`periods.${value}`) })),
  })

  return facets
}

/**
 * Cost and speed are missing on purpose: both live in `performanceStats`, which comes back
 * empty on every public model — through the listing, the search index and `GET /models/{id}`.
 */
export function sortOptions(t: Translate): { value: ModelSort; label: string }[] {
  return MODEL_SORTS.map(value => ({ value, label: t(`sorts.${value}`) }))
}

/** Keeps only what the facet still offers — see `queryFrom`. */
function offered(
  state: CollectionState,
  facet: string,
  options: readonly string[],
): readonly string[] {
  return selectedValues(state, facet).filter(value => options.includes(value))
}

/** A persisted state can hold a value the facet no longer offers; anything else is ignored. */
function chosen<T extends string>(
  state: CollectionState,
  facet: string,
  allowed: readonly T[],
): T | undefined {
  const [value] = selectedValues(state, facet)
  return allowed.find(candidate => candidate === value)
}

/**
 * Turns what the bar holds into what the API is asked. Only some of it narrows server-side —
 * family and capability are applied by the registry, which is why walking is bounded there.
 *
 * Every value is checked against what THIS family offers. The bar's state is shared by all
 * workspaces, so a capability picked under Image survives a switch to 3D: the menu no longer
 * lists it and shows nothing selected, while the query still carried it and emptied the panel.
 *
 * A `null` family is the whole catalogue, and the family is then left OUT of the query rather
 * than sent empty: the registry narrows on `family` only when it is there.
 */
export function queryFrom(
  state: CollectionState,
  family: ModelFamily | null,
  search: string,
): ModelQuery {
  const capabilities = offered(state, CAPABILITY_FACET, ownedBy(CAPABILITIES_BY_FAMILY, family))
  // One parameter for both: the API matches a publisher exactly as it matches any other tag.
  const tags = [
    ...offered(state, TAG_FACET, ownedBy(TAGS_BY_FAMILY, family)),
    ...offered(state, PUBLISHER_FACET, ownedBy(PUBLISHERS_BY_FAMILY, family)),
  ]
  const origin = chosen(state, ORIGIN_FACET, MODEL_ORIGINS)
  const since = chosen<ModelPeriod>(state, PERIOD_FACET, MODEL_PERIODS)
  const trimmed = search.trim()

  return {
    ...(family ? { family } : {}),
    sort: MODEL_SORTS.find(candidate => candidate === state.sort) ?? 'relevance',
    ...(trimmed ? { search: trimmed } : {}),
    ...(origin ? { origin } : {}),
    ...(capabilities.length ? { capabilities } : {}),
    ...(tags.length ? { tags } : {}),
    ...(since ? { since } : {}),
  }
}
