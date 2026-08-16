import { describe, expect, it } from 'vitest'
import type { FolderEntry } from '@shared/domain/folder'
import { entriesSorted } from './folder-sort'

const entry = (name: string, kind: FolderEntry['kind']): FolderEntry => ({
  path: name,
  name,
  kind,
})

/** As the disk answers it: folders first, then by name, in the reader's own language. */
const listing: readonly FolderEntry[] = [
  entry('Assets', 'folder'),
  entry('Repérages', 'folder'),
  entry('a3f1.scene', 'file'),
  entry('notes.txt', 'file'),
]

describe('the order the explorer draws', () => {
  it('leaves the listing alone in the order the disk answered', () => {
    expect(entriesSorted(listing, null, 'fr')).toBe(listing)
  })

  // Folders stay first the other way round too: reversing that is a different browser.
  it('turns the names around without mixing files into the folders', () => {
    expect(entriesSorted(listing, 'nameDesc', 'fr').map(one => one.name)).toEqual([
      'Repérages',
      'Assets',
      'notes.txt',
      'a3f1.scene',
    ])
  })
})
