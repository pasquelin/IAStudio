import { describe, expect, it } from 'vitest'
import type { FolderEntry } from '@shared/domain/folder'
import { entriesSorted } from './folderSort'

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
  /**
   * Sorted here even by default, because the whole-folder readers walk several folders at once:
   * what they hand back is ordered within each level and interleaved between them, in whatever
   * order the reads came home. Trusting the disk drew a project differently on every launch.
   */
  it('orders the rows itself rather than trusting the order it was handed', () => {
    const scrambled = [entry('notes.txt', 'file'), entry('Repérages', 'folder')]

    expect(entriesSorted(scrambled, null, 'fr').map(one => one.name)).toEqual([
      'Repérages',
      'notes.txt',
    ])
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
