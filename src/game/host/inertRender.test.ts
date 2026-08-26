// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest'
import { IDENTITY_TRANSFORM } from '@shared/domain/transform'
import { createInertRender } from './inertRender'
import type { EntityPlacement } from '../ports/renderPort'

describe('the render of a host with nothing to draw into', () => {
  /** A whole step at a time, and none of it drawn — see the note above `createInertRender`. */
  it('takes what a step moved and draws none of it', () => {
    const moved: EntityPlacement[] = [{ entity: 'a1b2', transform: IDENTITY_TRANSFORM }]

    expect(createInertRender().place(moved)).toBeUndefined()
  })
})
