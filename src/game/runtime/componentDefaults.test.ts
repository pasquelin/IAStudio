// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest'
import { COMPONENTS } from '@shared/domain/componentRegistry'
import { COMPONENT_DEFAULTS } from './componentDefaults'

/**
 * The half of the carve-out a suite can hold: the runtime ships without `@shared/`, so it copies
 * these numbers — and a test ships nowhere, so it may read both and refuse a drift.
 */
describe('the defaults a system falls back on', () => {
  it.each(Object.keys(COMPONENT_DEFAULTS))('says exactly what the registry says for %s', name => {
    const held = COMPONENT_DEFAULTS[name as keyof typeof COMPONENT_DEFAULTS]

    expect(held).toEqual(COMPONENTS[name as keyof typeof COMPONENTS].defaults)
  })
})
