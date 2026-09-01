import { describe, expect, it } from 'vitest'
import { DEFAULT_TEXTURE_MATERIAL } from './material'
import { nextStyleName, type MaterialStyle } from './style'

function styleNamed(name: string): MaterialStyle {
  return { id: name, name, createdAt: '2026-08-09T00:00:00.000Z', values: DEFAULT_TEXTURE_MATERIAL }
}

describe('naming a new style', () => {
  it('starts at one when nothing is saved', () => {
    expect(nextStyleName([], 'Style')).toBe('Style 1')
  })

  it('takes the first number no style holds', () => {
    expect(nextStyleName([styleNamed('Style 1'), styleNamed('Style 2')], 'Style')).toBe('Style 3')
  })

  it('fills a gap rather than counting the list', () => {
    expect(nextStyleName([styleNamed('Style 1'), styleNamed('Style 3')], 'Style')).toBe('Style 2')
  })

  it('ignores the styles the user has renamed', () => {
    expect(nextStyleName([styleNamed('Brushed metal'), styleNamed('Style 1')], 'Style')).toBe(
      'Style 2',
    )
  })

  it('never collides with a rename that looks generated', () => {
    const renamed = [styleNamed('Style 1'), styleNamed('Style 2'), styleNamed('Style 4')]
    expect(nextStyleName(renamed, 'Style')).toBe('Style 3')
  })

  it('follows the prefix it is given, since the word comes from the bundle', () => {
    expect(nextStyleName([styleNamed('Style 1')], 'Effet')).toBe('Effet 1')
  })
})
