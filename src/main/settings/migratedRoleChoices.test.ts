import { describe, expect, it } from 'vitest'
import { aiRoleId, type AiRoleId, type RoleProvider } from '@shared/domain/aiRole'
import { shippedModels } from '@main/ai/catalogue'
import { migratedRoleChoices } from './migratedRoleChoices'

/** A model of the shipped catalogue, whichever it is: the migration reads that list, not a name. */
const LOCAL = shippedModels()[0]?.id ?? 'ssd-1b'

const TXT2IMG = aiRoleId('image', 'txt2img')
const TXT23D = aiRoleId('3d', 'txt23d')

describe('what a per-family default becomes', () => {
  /**
   * The family's FIRST employment and no other: it is the only one that preference ever reached,
   * `resolveModelForFamily` having looked up `primaryRoleOf(family)` and nothing else.
   */
  it('lands on the first employment of its family', () => {
    expect(migratedRoleChoices({ image: LOCAL }, {})).toEqual({
      [TXT2IMG]: { kind: 'local', modelId: LOCAL },
    })
  })

  /**
   * 🛑 A cloud model loses its NAME, and it cannot be otherwise: a cloud provider says which
   * account pays, never which model runs. The employment comes back served by Scenario, with the
   * model to pick again.
   */
  it('keeps the account for a model this machine does not hold, having nowhere to put its name', () => {
    expect(migratedRoleChoices({ image: 'model_flux' }, {})).toEqual({
      [TXT2IMG]: { kind: 'cloud', providerId: 'scenario' },
    })
  })

  // The employment side is where this screen's successor writes, so its choice is the newer one.
  it('never writes over a choice already made on the employment itself', () => {
    const chosen: Partial<Record<AiRoleId, RoleProvider>> = {
      [TXT2IMG]: { kind: 'local', modelId: 'chosen' },
    }

    expect(migratedRoleChoices({ image: 'model_flux' }, chosen)).toEqual(chosen)
  })

  it('leaves the employments the old branch said nothing about alone', () => {
    const chosen: Partial<Record<AiRoleId, RoleProvider>> = {
      [TXT23D]: { kind: 'cloud', providerId: 'scenario' },
    }

    expect(migratedRoleChoices({ image: LOCAL }, chosen)).toEqual({
      [TXT2IMG]: { kind: 'local', modelId: LOCAL },
      ...chosen,
    })
  })

  // `other` generates nothing, so it has no employment to receive one.
  it('drops a family that has no employment at all', () => {
    expect(migratedRoleChoices({ other: 'model_flux' }, {})).toEqual({})
  })

  it('answers nothing for a file that never held the old branch', () => {
    expect(migratedRoleChoices({}, {})).toEqual({})
  })
})
