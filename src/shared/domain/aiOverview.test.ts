import { describe, expect, it } from 'vitest'
import { writeScopeFor } from './aiOverview'
import type { RoleRow } from './aiOverview'

const chosen = (project: RoleRow['chosen']['project']): Pick<RoleRow, 'chosen'> => ({
  chosen: { app: null, project },
})

describe('writeScopeFor', () => {
  /**
   * A choice written to the application while the open project overrides the role agrees with
   * itself and moves nothing on screen — which is what a click from the assistant modal did.
   */
  it('writes where the choice in force was written', () => {
    expect(writeScopeFor(chosen(null), null)).toBe('app')
    expect(writeScopeFor(chosen(null), '/projects/one')).toBe('app')
    expect(writeScopeFor(chosen({ kind: 'cloud', providerId: 'deepseek' }), '/projects/one')).toBe(
      'project',
    )
  })
})
