// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest'
import { UI_ELEMENT_TYPES } from '@shared/domain/ui'
import { INTRINSIC_SIZES, intrinsicSizeOf } from './uiIntrinsic'

describe('what a control covers when nothing sizes it', () => {
  it('gives a control its own box and leaves the rest to be measured', () => {
    expect(intrinsicSizeOf('checkbox')).toEqual({ width: 16, height: 16 })
    expect(intrinsicSizeOf('spacer')).toEqual({ width: 0, height: 0 })

    expect(intrinsicSizeOf('text')).toBeNull()
    expect(intrinsicSizeOf('image')).toBeNull()
    expect(intrinsicSizeOf('panel')).toBeNull()
  })

  /** The table is what makes a fourteenth type a compile error; an empty one would say nothing. */
  it('answers for every type of the closed list', () => {
    expect(Object.keys(INTRINSIC_SIZES).sort()).toEqual([...UI_ELEMENT_TYPES].sort())
  })
})
