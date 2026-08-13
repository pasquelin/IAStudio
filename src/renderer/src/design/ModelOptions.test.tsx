import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { PlanAccess } from '@shared/domain/plan'
import { ModelOptions, type PickableModel } from './ModelOptions'

const MODELS: PickableModel[] = [
  { id: 'free', name: 'Reachable' },
  { id: 'paid', name: 'Locked', requiredPlanLevel: 75 },
]

const STARTER: PlanAccess = { name: 'Starter', level: 25 }

function pick(models: readonly PickableModel[], plan: PlanAccess | null) {
  render(
    <select aria-label="models" defaultValue="">
      <ModelOptions models={models} plan={plan} />
    </select>,
  )
  return screen.getAllByRole('option')
}

describe('ModelOptions', () => {
  it('offers one option per model, in the order it was given them', () => {
    expect(pick(MODELS, STARTER).map(option => option.getAttribute('value'))).toEqual([
      'free',
      'paid',
    ])
  })

  // A disabled option emits no pointer event, so a tooltip would never fire: the reason has to
  // reach the label itself or the row is greyed out without a word.
  it('disables a model the plan refuses and says so in its label', () => {
    const [reachable, locked] = pick(MODELS, STARTER)

    expect(locked).toBeDisabled()
    expect(locked?.textContent).toContain('Locked')
    expect(locked?.textContent).not.toEqual('Locked')
    expect(reachable).toBeEnabled()
    expect(reachable?.textContent).toEqual('Reachable')
  })

  // An unread plan refuses nothing — greying a row out wrongly hides a model that would have run.
  it('refuses nothing while the plan is unknown', () => {
    for (const option of pick(MODELS, null)) expect(option).toBeEnabled()
  })
})
