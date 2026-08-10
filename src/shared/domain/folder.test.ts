import { describe, expect, it } from 'vitest'
import { compareEntries, isHiddenEntry, isUnder, parentOf, type FolderEntry } from './folder'

const entry = (name: string, kind: 'folder' | 'file'): FolderEntry => ({ path: name, name, kind })

describe('what the explorer does not show', () => {
  it.each(['.index', '.project.json', '.DS_Store'])('hides %s', name => {
    expect(isHiddenEntry(name)).toBe(true)
  })

  // Everything else shows, including what the studio cannot open — that is the difference
  // between an explorer and a list of documents.
  it.each(['assets', 'brief.pdf', 'a3f1.scene'])('shows %s', name => {
    expect(isHiddenEntry(name)).toBe(false)
  })
})

describe('the order a folder reads in', () => {
  it('puts folders before files', () => {
    expect(compareEntries(entry('zoo', 'folder'), entry('alpha', 'file'))).toBeLessThan(0)
  })

  // A project written in French files `Étude` between `Etat` and `Fond` for a reader, and after
  // `Zoo` for a code unit comparison.
  it('sorts accented names where a reader looks for them', () => {
    const sorted = [entry('Zoo', 'file'), entry('Étude', 'file'), entry('Fond', 'file')].sort(
      compareEntries,
    )

    expect(sorted.map(one => one.name)).toEqual(['Étude', 'Fond', 'Zoo'])
  })
})

/**
 * The word that matters is STRICTLY. A folder read again replaces what is under it, and a
 * folder counted as being under itself replaces its own row — which emptied the whole tree.
 */
describe('what a folder holds', () => {
  it('holds what is inside it', () => {
    expect(isUnder('assets/img', 'assets')).toBe(true)
    expect(isUnder('assets/img/one.png', 'assets')).toBe(true)
  })

  it('does not hold itself', () => {
    expect(isUnder('assets', 'assets')).toBe(false)
  })

  it('does not hold a folder whose name merely starts the same', () => {
    expect(isUnder('assets-old/one.png', 'assets')).toBe(false)
  })

  it('holds everything, at the root', () => {
    expect(isUnder('assets', '')).toBe(true)
    expect(isUnder('assets/img/one.png', '')).toBe(true)
  })
})

describe('the folder an entry sits in', () => {
  it('is the tree parent', () => {
    expect(parentOf('assets/img/one.png')).toBe('assets/img')
  })

  it('is nothing at the root, which is what the tree calls a root node', () => {
    expect(parentOf('assets')).toBeNull()
  })
})
