import type { TFunction } from 'i18next'
import { describe, expect, it } from 'vitest'
import type { ModelSummary } from '@shared/domain/model'
import { modelSubtitle } from './modelSubtitle'

/**
 * A bundle holding the two keys this file needs and nothing else, so what is read is the
 * composition rather than a wording — and so the fallback below is really exercised: a `t` that
 * answered every key would never reach `defaultValue`.
 */
const KNOWN: Record<string, string> = {
  'models.featured': 'Featured',
  'models.community': 'Community',
  'capabilities.img23d': 'Image to mesh',
}

const t = ((key: string, options?: { defaultValue?: string }) =>
  KNOWN[key] ?? options?.defaultValue ?? key) as unknown as TFunction

function model(over: Partial<ModelSummary> = {}): ModelSummary {
  return {
    id: 'triposr',
    name: 'TripoSR',
    family: '3d',
    runsOn: 'local',
    source: 'https://example.invalid',
    origin: 'community',
    featured: false,
    capabilities: ['img23d'],
    tags: [],
    ...over,
  }
}

describe('the line under a model name', () => {
  it('lets the catalogue description replace the origin, and keeps the standing in front', () => {
    expect(modelSubtitle(model({ description: '2024 · Fastest', featured: true }), t)).toBe(
      'Featured · 2024 · Fastest',
    )
  })

  it('gives a plain description no standing at all', () => {
    expect(modelSubtitle(model({ description: '2024 · Fastest' }), t)).toBe('2024 · Fastest')
  })

  it('falls back to the standing and the first capability when nothing describes the model', () => {
    expect(modelSubtitle(model(), t)).toBe('Community · Image to mesh')
  })

  // The API publishes capabilities this studio has no word for, and a missing key on screen is
  // the repository's costliest defect.
  it('shows an unknown capability by its API name rather than by a missing key', () => {
    const said = modelSubtitle(model({ capabilities: ['img2vid-unheard-of'] }), t)
    expect(said).toBe('Community · img2vid-unheard-of')
  })
})
