import { describe, expect, it } from 'vitest'
import {
  ACTIVITY_LEVELS,
  ACTIVITY_TOPICS,
  isActivityLevel,
  isActivityTopic,
  matchesActivity,
  type ActivityDraft,
  type ActivityQuery,
} from './activity'

const line = (overrides: Partial<ActivityDraft> = {}): ActivityDraft => ({
  at: '2026-08-08T10:00:00.000Z',
  level: 'error',
  topic: 'generation',
  messageKey: 'activity.jobFailed',
  ...overrides,
})

describe('what a line of the journal is', () => {
  it('recognises the levels it lists, and nothing else', () => {
    for (const level of ACTIVITY_LEVELS) expect(isActivityLevel(level)).toBe(true)

    expect(isActivityLevel('fatal')).toBe(false)
    expect(isActivityLevel(undefined)).toBe(false)
    expect(isActivityLevel(1)).toBe(false)
  })

  it('recognises the topics it lists, and nothing else', () => {
    for (const topic of ACTIVITY_TOPICS) expect(isActivityTopic(topic)).toBe(true)

    expect(isActivityTopic('weather')).toBe(false)
    expect(isActivityTopic(null)).toBe(false)
  })
})

describe('filtering the journal', () => {
  // An absent list and an empty one are the same question asked twice; a panel that has just
  // cleared its filters would otherwise show nothing at all.
  it('lets everything through when nothing is asked for', () => {
    expect(matchesActivity(line(), {})).toBe(true)
    expect(matchesActivity(line(), { levels: [], topics: [] })).toBe(true)
  })

  it('keeps the levels that were asked for', () => {
    expect(matchesActivity(line(), { levels: ['error'] })).toBe(true)
    expect(matchesActivity(line({ level: 'info' }), { levels: ['error'] })).toBe(false)
  })

  it('keeps the topics that were asked for', () => {
    expect(matchesActivity(line(), { topics: ['generation'] })).toBe(true)
    expect(matchesActivity(line({ topic: 'import' }), { topics: ['generation'] })).toBe(false)
  })

  it('asks both questions at once, not either', () => {
    const query: ActivityQuery = { levels: ['error'], topics: ['import'] }

    expect(matchesActivity(line({ level: 'error', topic: 'import' }), query)).toBe(true)
    expect(matchesActivity(line({ level: 'error', topic: 'generation' }), query)).toBe(false)
    expect(matchesActivity(line({ level: 'info', topic: 'import' }), query)).toBe(false)
  })
})
