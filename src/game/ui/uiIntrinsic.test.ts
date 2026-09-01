// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest'
import { intrinsicSizeOf } from './uiIntrinsic'

describe('what a control covers when nothing sizes it', () => {
  it('gives a control its own box and leaves the rest to be measured', () => {
    expect(intrinsicSizeOf('checkbox')).toEqual({ width: 16, height: 16 })
    expect(intrinsicSizeOf('spacer')).toEqual({ width: 0, height: 0 })

    expect(intrinsicSizeOf('text')).toBeNull()
    expect(intrinsicSizeOf('image')).toBeNull()
    expect(intrinsicSizeOf('panel')).toBeNull()
  })
})
