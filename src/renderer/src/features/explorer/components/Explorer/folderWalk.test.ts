import { describe, expect, it } from 'vitest'
import { FOLDER_ROOT } from '@shared/domain/folder'
import { canWalkBy, FOLDER_WALK_START, walkedBy, walkedTo, walkInto } from './folderWalk'

const walkOf = (...folders: readonly string[]) => folders.reduce(walkInto, FOLDER_WALK_START)

describe('folderWalk', () => {
  it('walks back out of a folder to the one it was entered from', () => {
    expect(walkedTo(walkedBy(walkOf('Images', 'Images/Croquis'), -1))).toBe('Images')
  })

  it('walks forward again into the folder that was left', () => {
    expect(walkedTo(walkedBy(walkedBy(walkOf('Images', 'Images/Croquis'), -1), 1))).toBe(
      'Images/Croquis',
    )
  })

  /** A branch taken after going back replaces the one abandoned — a browser does the same. */
  it('drops what was ahead once another folder is entered', () => {
    const walk = walkInto(walkedBy(walkOf('Images', 'Images/Croquis'), -1), 'Images/Rendus')

    expect(canWalkBy(walk, 1)).toBe(false)
    expect(walkedTo(walkedBy(walk, -1))).toBe('Images')
  })

  it('has nowhere to go from a project never walked out of', () => {
    expect(canWalkBy(FOLDER_WALK_START, -1)).toBe(false)
    expect(canWalkBy(FOLDER_WALK_START, 1)).toBe(false)
    expect(walkedTo(FOLDER_WALK_START)).toBe(FOLDER_ROOT)
  })

  /** Clicking the crumb of the folder already shown is not a step: it would fill the walk. */
  it('ignores a walk into the folder already shown', () => {
    expect(walkInto(walkOf('Images'), 'Images').trail).toHaveLength(2)
  })
})
