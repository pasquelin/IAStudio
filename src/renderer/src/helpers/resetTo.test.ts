import { describe, expect, it, vi } from 'vitest'
import { resetTo } from './resetTo'

describe('what a reset button is handed', () => {
  it('acts where the value has moved off its default', () => {
    const apply = vi.fn()

    resetTo(0.4, 1, apply)?.()

    expect(apply).toHaveBeenCalledWith(1)
  })

  /** Inert rather than absent: a button appearing mid-drag narrows the field under the pointer. */
  it('is nothing at all where the value already stands there', () => {
    expect(resetTo(1, 1, vi.fn())).toBeUndefined()
  })

  /**
   * A descriptor with no factory leaves the button inert rather than lying about a default nobody
   * can name.
   */
  it('is nothing where no default can be named', () => {
    expect(resetTo(0.4, undefined, vi.fn())).toBeUndefined()
  })
})
