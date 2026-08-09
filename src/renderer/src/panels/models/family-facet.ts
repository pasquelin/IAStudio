/**
 * The key of the family facet, alone in its file — as `assets/type-facet.ts` is.
 *
 * `helpers/reveal-panel.ts` writes this facet before bringing the browser up, and reveal-panel
 * is reached by the opening chunk: importing it from `model-filters.ts` would drag the whole
 * model vocabulary into what the splash screen waits for, which a guard refuses (`eager-graph`).
 */
export const FAMILY_FACET = 'family'
