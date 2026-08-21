import { describe, expect, it } from 'vitest'
import {
  ACCOUNT_NAME_MAX_LENGTH,
  checkAccountName,
  type AccountSummary,
} from '@shared/domain/account'
import { SCENARIO_CLOUD } from '@shared/domain/aiCloud'

const existing: AccountSummary[] = [
  { id: 'a', name: 'Studio', providerId: SCENARIO_CLOUD, active: true },
  { id: 'b', name: 'Client X', providerId: SCENARIO_CLOUD, active: false },
]

describe('checkAccountName', () => {
  it('accepts a name nobody holds', () => {
    expect(checkAccountName('Démo', existing)).toBeNull()
  })

  it('refuses an empty name', () => {
    expect(checkAccountName('', existing)).toBe('empty')
  })

  it('refuses a name made of spaces alone', () => {
    expect(checkAccountName('   ', existing)).toBe('empty')
  })

  it('refuses a name past the length limit', () => {
    expect(checkAccountName('x'.repeat(ACCOUNT_NAME_MAX_LENGTH + 1), existing)).toBe('too-long')
    expect(checkAccountName('x'.repeat(ACCOUNT_NAME_MAX_LENGTH), existing)).toBeNull()
  })

  it('refuses a name another account already holds', () => {
    expect(checkAccountName('Client X', existing)).toBe('duplicate')
  })

  // Two entries reading the same in the switch would leave the user picking blind.
  it('compares names regardless of case and surrounding spaces', () => {
    expect(checkAccountName('  client x  ', existing)).toBe('duplicate')
  })

  it('lets an account keep its own name while being renamed', () => {
    expect(checkAccountName('Client X', existing, 'b')).toBeNull()
  })

  it('still refuses a sibling name while being renamed', () => {
    expect(checkAccountName('Studio', existing, 'b')).toBe('duplicate')
  })
})
