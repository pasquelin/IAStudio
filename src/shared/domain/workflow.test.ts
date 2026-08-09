import { describe, expect, it } from 'vitest'
import {
  isRunnable,
  WORKFLOW_PRIVACIES,
  WORKFLOW_STATUSES,
  type WorkflowPrivacy,
  type WorkflowStatus,
  type WorkflowSummary,
} from './workflow'

const app: WorkflowSummary = {
  id: 'workflow_1',
  name: 'Background remover',
  status: 'ready',
  privacy: 'public',
  tags: ['tool'],
}

describe('workflow domain', () => {
  it('names every status and every privacy level', () => {
    const statuses: Record<WorkflowStatus, true> = { draft: true, ready: true, deleted: true }
    const privacies: Record<WorkflowPrivacy, true> = {
      private: true,
      public: true,
      unlisted: true,
    }

    expect([...WORKFLOW_STATUSES].sort()).toEqual(Object.keys(statuses).sort())
    expect([...WORKFLOW_PRIVACIES].sort()).toEqual(Object.keys(privacies).sort())
  })

  it('runs a ready workflow and refuses a draft', () => {
    expect(isRunnable(app)).toBe(true)
    expect(isRunnable({ ...app, status: 'draft' })).toBe(false)
    expect(isRunnable({ ...app, status: 'deleted' })).toBe(false)
  })
})
