import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPlanReader, teamsOf, type RemoteTeams, type TeamsCatalog } from './plan'
import { createCredentialsWatch } from './credentials-watch'

vi.mock('@main/log', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

/** What `GET /teams` answers, spelled as the plans it carries. */
const teams =
  (...plans: readonly string[]) =>
  (): Promise<RemoteTeams> =>
    Promise.resolve({ teams: plans.map(plan => ({ plan })) })

describe('plan reader', () => {
  let clock = 0

  beforeEach(() => {
    clock = 0
  })

  /** Counts the round trips, which is half of what this module is for. */
  function readerOf(answer: () => Promise<RemoteTeams>, watch = createCredentialsWatch()) {
    let calls = 0
    const catalog: TeamsCatalog = {
      teams: () => {
        calls += 1
        return answer()
      },
    }

    return {
      reader: createPlanReader({ catalog: () => catalog, watch: watch.watch, now: () => clock }),
      calls: () => calls,
      watch,
    }
  }

  it('reads the plan the account answers', async () => {
    const { reader } = readerOf(teams('cu-basic'))

    expect(await reader.access()).toEqual({ name: 'cu-basic', level: 25 })
  })

  it('asks once and serves the rest from its cache', async () => {
    const { reader, calls } = readerOf(teams('cu-basic'))

    await reader.access()
    await reader.access()
    await reader.access()

    expect(calls()).toBe(1)
  })

  it('asks again once its entry has aged out', async () => {
    const { reader, calls } = readerOf(teams('cu-basic'))

    await reader.access()
    clock = 11 * 60 * 1000
    await reader.access()

    expect(calls()).toBe(2)
  })

  // The cache holds one account's answer and nothing in it says which.
  it('drops what it holds when the account changes', async () => {
    const { reader, calls, watch } = readerOf(teams('cu-basic'))

    await reader.access()
    watch.changed()
    await reader.access()

    expect(calls()).toBe(2)
  })

  // A refused or unreachable `/teams` must leave the picker exactly as it was.
  it('answers nothing rather than throwing when the call is refused', async () => {
    const { reader } = readerOf(() => Promise.reject(new Error('nope')))

    expect(await reader.access()).toBeNull()
  })

  it('answers nothing when the account holds no team at all', async () => {
    const { reader } = readerOf(() => Promise.resolve({}))

    expect(await reader.access()).toBeNull()
  })

  // Reading the weakest would grey out models one of the teams can run. Both orders: the API
  // sorts its teams however it likes, and a max that only holds when the list rises is a bug.
  it.each([
    ['rising', ['cu-basic', 'cu-pro-q3-25']],
    ['falling', ['cu-pro-q3-25', 'cu-basic']],
  ])('keeps the strongest plan of an account holding several, listed %s', async (_order, plans) => {
    const { reader } = readerOf(teams(...plans))

    expect(await reader.access()).toEqual({ name: 'cu-pro-q3-25', level: 50 })
  })

  // An ungradable name still travels: the panel shows the plan it could not read rather than
  // claiming the account has none.
  it('carries a name it cannot grade, with no level', async () => {
    const { reader } = readerOf(teams('cu-something-new'))

    expect(await reader.access()).toEqual({ name: 'cu-something-new', level: null })
  })

  // A level is what deciding anything takes, so a graded plan wins wherever it sits in the list
  // — both orders, since an account lists its teams in whatever order the API answers.
  it.each([
    ['before', ['cu-something-new', 'cu-basic']],
    ['after', ['cu-basic', 'cu-something-new']],
  ])('prefers a plan it can grade over one it cannot, listed %s it', async (_where, plans) => {
    const { reader } = readerOf(teams(...plans))

    expect(await reader.access()).toEqual({ name: 'cu-basic', level: 25 })
  })
})

describe('teamsOf', () => {
  // The SDK has no `teams` resource at 2.7.0 — measured — so the path is spelled here and
  // nowhere else. A typo in it would answer 404 and grey out nothing, silently.
  it('asks the endpoint that carries the plan', async () => {
    const paths: string[] = []
    const catalog = teamsOf({
      get: (path: string) => {
        paths.push(path)
        // The SDK types `get` as returning an APIPromise; a plain promise is all this reads.
        return Promise.resolve({ teams: [{ plan: 'cu-basic' }] })
      },
    })

    await expect(catalog.teams()).resolves.toEqual({ teams: [{ plan: 'cu-basic' }] })
    expect(paths).toEqual(['/teams'])
  })
})
