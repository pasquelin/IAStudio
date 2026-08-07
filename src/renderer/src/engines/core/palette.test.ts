import { beforeEach, describe, expect, it } from 'vitest'
import { token, tokenAsHex } from './palette'

let element: HTMLElement

beforeEach(() => {
  document.body.innerHTML = ''
  element = document.createElement('div')
  element.style.setProperty('--sample', '#3574f0')
  document.body.appendChild(element)
})

describe('token', () => {
  it('reads a custom property off the element', () => {
    expect(token(element, '--sample')).toBe('#3574f0')
  })

  it('answers with an empty string for a token nobody declared', () => {
    expect(token(element, '--absent')).toBe('')
  })
})

describe('tokenAsHex', () => {
  it('parses a six-digit hex token', () => {
    expect(tokenAsHex(element, '--sample', 0xffffff)).toBe(0x3574f0)
  })

  // A missing token must not read as black: that is a colour, and a wrong one.
  it('falls back when the token is missing', () => {
    expect(tokenAsHex(element, '--absent', 0xff0000)).toBe(0xff0000)
  })

  it('falls back when the token is not a hex colour', () => {
    element.style.setProperty('--named', 'rebeccapurple')
    expect(tokenAsHex(element, '--named', 0xff0000)).toBe(0xff0000)
  })
})
