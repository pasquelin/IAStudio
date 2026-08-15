import { describe, expect, it } from 'vitest'
import {
  ACTIVITY_LEVELS,
  ACTIVITY_TOPICS,
  boundedToasts,
  isActivityLevel,
  isActivityTopic,
  isToastWorthy,
  matchesActivity,
  type ActivityDraft,
  type ActivityEntry,
  type ActivityFilter,
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
    const query: ActivityFilter = { levels: ['error'], topics: ['import'] }

    expect(matchesActivity(line({ level: 'error', topic: 'import' }), query)).toBe(true)
    expect(matchesActivity(line({ level: 'error', topic: 'generation' }), query)).toBe(false)
    expect(matchesActivity(line({ level: 'info', topic: 'import' }), query)).toBe(false)
  })
})

/**
 * Which lines claim the corner of the screen. The axis is the MESSAGE and not the level, because
 * the two `warn` sites that already existed both argued for staying quiet where they are written
 * — and toasts do not expire, so a caption batch refused inside a loop over every batch would
 * leave the user closing them one by one.
 */
describe('what claims the corner of the screen', () => {
  const toast = (overrides: Partial<ActivityEntry> = {}): ActivityEntry => ({
    ...line(),
    id: 1,
    ...overrides,
  })

  it('raises every failure', () => {
    expect(isToastWorthy(line({ level: 'error' }))).toBe(true)
  })

  it('raises a line that asks for attention by name, whatever its level', () => {
    expect(
      isToastWorthy(line({ level: 'warn', messageKey: 'activity.projectAccountSwitched' })),
    ).toBe(true)
  })

  it('leaves an ordinary warning, and anything merely informative, in the journal', () => {
    expect(isToastWorthy(line({ level: 'warn', messageKey: 'activity.tagsNotSynced' }))).toBe(false)
    expect(isToastWorthy(line({ level: 'info', messageKey: 'activity.imported' }))).toBe(false)
  })

  it('keeps everything while there is room', () => {
    const lines = [toast({ id: 1 }), toast({ id: 2 })]

    expect(boundedToasts(lines, 3)).toEqual(lines)
  })

  /**
   * The burst a switch of key provokes: every cache is purged, so refetching under a key the API
   * refuses answers a run of failures. Evicting by arrival alone would push out the one sentence
   * saying the key had changed.
   */
  it('drops failures before the lines that asked for attention', () => {
    const asking = toast({ id: 9, level: 'warn', messageKey: 'activity.projectAccountSwitched' })
    const failures = [1, 2, 3, 4].map(id => toast({ id }))

    expect(boundedToasts([...failures, asking], 2).map(one => one.id)).toEqual([1, 9])
  })

  // More asking than there is room for: the newest win, and no failure takes a place from them.
  it('bounds the attention lines themselves rather than overflowing', () => {
    const asking = [1, 2, 3].map(id =>
      toast({ id, level: 'warn', messageKey: 'activity.projectAccountMissing' }),
    )

    expect(boundedToasts([...asking, toast({ id: 4 })], 2).map(one => one.id)).toEqual([1, 2])
  })
})
