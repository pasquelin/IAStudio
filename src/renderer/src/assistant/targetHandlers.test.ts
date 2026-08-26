import { beforeEach, describe, expect, it, vi } from 'vitest'
import { refused } from '@shared/domain/assistant'
import { TARGET_HANDLERS } from './targetHandlers'

const aimAt = vi.hoisted(() => vi.fn())
vi.mock('./documentTargets', () => ({ aimAt }))

const aim = (input: Record<string, unknown>) => TARGET_HANDLERS['target.select']?.(input)

beforeEach(() => {
  aimAt.mockReset()
})

describe('target.select', () => {
  it('hands the id to whichever space holds the document in front', () => {
    aimAt.mockReturnValue({ ok: true })

    expect(aim({ aimId: 'sky' })).toEqual({ ok: true })
    expect(aimAt).toHaveBeenCalledWith('sky')
  })

  it('answers what the space answered, refusal and all', () => {
    aimAt.mockReturnValue(refused('notFound'))

    expect(aim({ aimId: 'gone' })).toEqual({ ok: false, refusal: 'notFound' })
  })

  it('refuses a call that names nothing, without reaching a space', () => {
    expect(aim({})).toMatchObject({ ok: false, refusal: 'badInput' })
    expect(aimAt).not.toHaveBeenCalled()
  })
})
