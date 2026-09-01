// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest'
import { createInertUiRender } from './inertUiRender'

describe('the interface render of a host with nowhere to draw', () => {
  it('takes a frame, draws none of it, and touches nothing that was picked', () => {
    const render = createInertUiRender()

    expect(render.draw([])).toBeUndefined()
    expect(render.resize({ width: 800, height: 600 })).toBeUndefined()
    // 🛑 Nothing, never a guess: a caller reading a hit off a surface that does not exist would
    // act on an element nobody could have touched.
    expect(render.pick({ x: 10, y: 10 })).toBeNull()
  })
})
