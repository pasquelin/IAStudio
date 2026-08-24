import { describe, expect, it } from 'vitest'
import { aiRoleId } from '@shared/domain/aiRole'
import { spacesWithNoModel, SPACE_ROLES } from './spacesWithNoModel'

describe('the spaces nothing can generate in', () => {
  it('names the space of an unserved employment, and leaves the others out', () => {
    expect(spacesWithNoModel([aiRoleId('image', 'txt2img')])).toEqual(['image'])
  })

  it('names none when every employment is served', () => {
    expect(spacesWithNoModel([])).toEqual([])
  })

  // One weighing per space and no more: what the manager is asked per sentence.
  it('asks after one employment per space', () => {
    expect(SPACE_ROLES).toHaveLength(6)
  })
})
