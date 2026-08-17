import { afterEach, describe, expect, it } from 'vitest'
import { offScreenHost } from './offScreenHost'

afterEach(() => {
  document.body.replaceChildren()
})

describe('a host for a picture nobody is watching', () => {
  it('is laid out at the size asked for, out of view and out of reach', () => {
    const host = offScreenHost(1920, 1080)

    expect(host.parentElement).toBe(document.body)
    expect(host.style.width).toBe('1920px')
    expect(host.style.height).toBe('1080px')
    // Taken out of the flow BEFORE being pushed away: `left` moves nothing on a block still in
    // it, and the host would sit at the top of the page in plain view.
    expect(host.style.position).toBe('fixed')
    expect(Number.parseInt(host.style.left, 10)).toBeLessThan(-10_000)
    expect(host.style.pointerEvents).toBe('none')
  })

  it('opens one host per caller, so two renders never share a box', () => {
    offScreenHost(16, 9)
    offScreenHost(16, 9)

    expect(document.body.children).toHaveLength(2)
  })
})
