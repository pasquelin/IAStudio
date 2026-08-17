import { describe, expect, it } from 'vitest'
import { FOLDER_ROOT } from '@shared/domain/folder'
import { folderTrail } from './folderTrail'

describe('folderTrail', () => {
  it('leads from the project folder down to the one being browsed', () => {
    expect(folderTrail('Images/Rendus')).toEqual([FOLDER_ROOT, 'Images', 'Images/Rendus'])
  })

  /**
   * The project folder is a crumb like any other, and the only one shown at the top: a trail that
   * were empty there would leave the grid with no way back once it had gone down a level.
   */
  it('is the project folder alone at the top', () => {
    expect(folderTrail(FOLDER_ROOT)).toEqual([FOLDER_ROOT])
  })
})
