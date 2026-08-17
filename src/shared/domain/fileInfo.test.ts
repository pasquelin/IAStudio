import { describe, expect, it } from 'vitest'
import { fileInfoPathOf, fileInfoRoute, isFileInfoRoute } from './fileInfo'

describe('the route one file information window loads', () => {
  it('carries a path back unchanged, separators and spaces included', () => {
    const path = 'Images/Mes prises/façade nº2.jpg'
    expect(fileInfoPathOf(fileInfoRoute(path))).toBe(path)
  })

  it('reads a fragment the browser handed back with its leading hash', () => {
    expect(fileInfoPathOf(`#${fileInfoRoute('Notes/brief.txt')}`)).toBe('Notes/brief.txt')
  })

  it('tells its own fragments from every other window of the studio', () => {
    expect(isFileInfoRoute(fileInfoRoute('a.png'))).toBe(true)
    expect(isFileInfoRoute('settings/general')).toBe(false)
    // The bare word names no file, so it is not one of ours: the window would open on nothing.
    expect(isFileInfoRoute('file-info')).toBe(false)
  })

  it('answers nothing rather than throwing on a fragment nobody built', () => {
    expect(fileInfoPathOf('file-info/%E0%A4%A')).toBeNull()
    expect(fileInfoPathOf('usage')).toBeNull()
  })
})
