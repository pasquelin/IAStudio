import { describe, expect, it } from 'vitest'
import type { AccountSummary } from './account'
import {
  listedAt,
  planProjectAccount,
  projectPickerFolder,
  projectsByCreation,
  renamedRecentProject,
  RECENT_PROJECTS_MAX,
  withRecentProject,
  type Project,
  type RecentProject,
} from './project'

function project(path: string, name = path): Project {
  return {
    path,
    manifest: { version: 1, name, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01' },
  }
}

function recent(count: number): RecentProject[] {
  return Array.from({ length: count }, (_, index) => ({
    path: `/projects/p${index}`,
    name: `P${index}`,
    openedAt: '2026-01-01T00:00:00Z',
  }))
}

describe('remembering an opened project', () => {
  // Storage order, which is what decides eviction — never what a screen draws. See the suite
  // below, which holds the order the eye gets.
  it('puts it first, and carries the date the project was MADE', () => {
    const list = withRecentProject(recent(3), project('/projects/new'), '2026-08-08T10:00:00Z')

    expect(list[0]).toEqual({
      path: '/projects/new',
      name: '/projects/new',
      openedAt: '2026-08-08T10:00:00Z',
      createdAt: '2026-01-01T00:00:00Z',
    })
  })

  it('lists a project once however often it is reopened', () => {
    const once = withRecentProject(recent(3), project('/projects/p1'), '2026-08-08T10:00:00Z')
    const twice = withRecentProject(once, project('/projects/p1'), '2026-08-08T11:00:00Z')

    expect(twice.filter(entry => entry.path === '/projects/p1')).toHaveLength(1)
    expect(twice[0]?.openedAt).toBe('2026-08-08T11:00:00Z')
    expect(twice).toHaveLength(3)
  })

  it('keeps the name the manifest gives, not the folder it sits in', () => {
    const list = withRecentProject([], project('/somewhere/untitled', 'Summer campaign'), 'now')

    expect(list[0]?.name).toBe('Summer campaign')
  })

  it('stays bounded, dropping the one opened longest ago', () => {
    const full = recent(RECENT_PROJECTS_MAX)
    const list = withRecentProject(full, project('/projects/new'), 'now')

    expect(list).toHaveLength(RECENT_PROJECTS_MAX)
    expect(list.map(entry => entry.path)).not.toContain(`/projects/p${RECENT_PROJECTS_MAX - 1}`)
  })
})

/**
 * The order a screen draws, which is deliberately NOT the stored one. Both the home's panel and the
 * title bar's menu read this: one list read in two orders is a list nobody trusts.
 */
describe('listing the projects for the eye', () => {
  const made = (
    path: string,
    createdAt: string,
    openedAt = '2026-01-01T00:00:00Z',
  ): RecentProject => ({ path, name: path, openedAt, createdAt })

  it('puts the newest-MADE project first, whatever order they are stored in', () => {
    const list = projectsByCreation([
      made('/old', '2026-01-01T00:00:00Z'),
      made('/newest', '2026-08-13T00:00:00Z'),
      made('/middle', '2026-05-01T00:00:00Z'),
    ])

    expect(list.map(entry => entry.path)).toEqual(['/newest', '/middle', '/old'])
  })

  /**
   * The defect this whole key exists for: opening a project rewrites the stored order, and a list
   * drawn from it therefore moved the row that had just been clicked to the top. The creation date
   * is the one key an opening cannot touch, so the two orders below must be identical.
   */
  it('does not move a project because it was just opened', () => {
    const before = [made('/a', '2026-01-01T00:00:00Z'), made('/b', '2026-02-01T00:00:00Z')]
    const after = withRecentProject(before, project('/a'), '2026-08-13T10:00:00Z')

    expect(projectsByCreation(after).map(entry => entry.path)).toEqual(
      projectsByCreation(before).map(entry => entry.path),
    )
  })

  /**
   * An entry stored before `createdAt` existed. Falling back to `openedAt` rather than to the epoch
   * is the whole point: sorted as the epoch, every project a user already had would be buried under
   * the first one made after the upgrade.
   */
  it('falls back to the opening date for an entry that predates the field', () => {
    const legacy: RecentProject = { path: '/legacy', name: 'L', openedAt: '2026-08-12T00:00:00Z' }

    expect(listedAt(legacy)).toBe('2026-08-12T00:00:00Z')
    expect(projectsByCreation([made('/older', '2026-03-01T00:00:00Z'), legacy])[0]?.path).toBe(
      '/legacy',
    )
  })

  it('breaks a tie on the path, so two projects made at once never swap between renders', () => {
    const same = '2026-08-13T00:00:00Z'
    const one = projectsByCreation([made('/b', same), made('/a', same)])
    const other = projectsByCreation([made('/a', same), made('/b', same)])

    expect(one.map(entry => entry.path)).toEqual(['/a', '/b'])
    expect(other.map(entry => entry.path)).toEqual(one.map(entry => entry.path))
  })

  it('leaves the list it was given alone', () => {
    const stored = [made('/a', '2026-01-01T00:00:00Z'), made('/b', '2026-08-01T00:00:00Z')]
    projectsByCreation(stored)

    expect(stored.map(entry => entry.path)).toEqual(['/a', '/b'])
  })
})

/**
 * Renaming an entry of the shelf. The name is STORED rather than derived from the folder, so the
 * manifest write and this one belong together — otherwise the project goes on being listed under
 * its old name until it is next opened.
 */
describe('renaming a remembered project', () => {
  const entry = (path: string, name: string): RecentProject => ({
    path,
    name,
    openedAt: '2026-08-01T00:00:00Z',
    createdAt: '2026-05-01T00:00:00Z',
  })

  it('renames the one entry and no other', () => {
    const list = renamedRecentProject([entry('/a', 'A'), entry('/b', 'B')], '/b', 'Renamed')

    expect(list.map(one => one.name)).toEqual(['A', 'Renamed'])
  })

  /**
   * A rename is not an opening. Stamping either date would move the row in the order the screens
   * read — `createdAt` is the sort key, `openedAt` decides eviction — so a gesture that changes a
   * word would silently reshuffle the list or throw away a different project.
   */
  it('touches neither date, so nothing moves and nothing is evicted differently', () => {
    const before = entry('/a', 'A')

    expect(renamedRecentProject([before], '/a', 'Renamed')[0]).toEqual({
      ...before,
      name: 'Renamed',
    })
  })

  // The open project need not be a remembered one, so an unknown path is not an error.
  it('leaves a list that does not hold the path alone', () => {
    const list = [entry('/a', 'A')]

    expect(renamedRecentProject(list, '/elsewhere', 'Renamed')).toEqual(list)
  })

  it('leaves the list it was given alone', () => {
    const list = [entry('/a', 'A')]
    renamedRecentProject(list, '/a', 'Renamed')

    expect(list[0]?.name).toBe('A')
  })
})

/**
 * Which API key a project works under. The link itself lives in `storage.projectAccounts`, a
 * branch of its own rather than a field of the shelf above: that list is bounded, evicted by
 * opening date, and emptied of an entry whenever an OPENING FAILS. A project on a drive that was
 * not plugged in would have come back on someone else's key, in silence.
 */
describe('planning the account a project opens on', () => {
  const accounts = (activeId: string): AccountSummary[] =>
    [
      { id: 'account_one', name: 'Studio' },
      { id: 'account_two', name: 'Client' },
    ].map(account => ({ ...account, active: account.id === activeId }))

  it('restores the linked account when it is held and not in force', () => {
    expect(planProjectAccount('account_two', accounts('account_one'))).toEqual({
      kind: 'restore',
      account: { id: 'account_two', name: 'Client', active: false },
    })
  })

  // The common case, and the one that must cost nothing: reopening a project already on its key.
  it('keeps the active account when the link already names it', () => {
    expect(planProjectAccount('account_one', accounts('account_one'))).toEqual({ kind: 'keep' })
  })

  // A project made before this was recorded, or made a moment ago.
  it('adopts the active account when nothing is linked', () => {
    expect(planProjectAccount(undefined, accounts('account_one'))).toEqual({ kind: 'adopt' })
  })

  /**
   * Removing a key and adding it back mints a fresh id, so a live key can leave a link naming
   * nothing. Told apart from "no link at all" because only one of the two owes the user a
   * sentence: collapsing them would either warn on every project ever made, or never warn.
   */
  it('reports a link naming an account that is no longer held', () => {
    expect(planProjectAccount('account_gone', accounts('account_one'))).toEqual({ kind: 'missing' })
  })
})

/**
 * Left to the system, the dialog reopens wherever it last was — which after a creation is inside
 * the project just made, so the second project of a session landed within the first.
 */
describe('where the folder dialog should open', () => {
  const madeIn = (path: string): RecentProject => ({
    path,
    name: 'A project',
    openedAt: '2026-08-16T10:00:00Z',
    createdAt: '2026-08-16T10:00:00Z',
  })

  it('answers the preference when the user set one', () => {
    expect(projectPickerFolder('/Users/someone/Projets', [madeIn('/elsewhere/Reel')])).toBe(
      '/Users/someone/Projets',
    )
  })

  // An empty preference means "follow me", which is what the newest project's folder does.
  it('falls back to the folder holding the newest project', () => {
    expect(projectPickerFolder(undefined, [madeIn('/Users/someone/Mes Projets/Reel')])).toBe(
      '/Users/someone/Mes Projets',
    )
  })

  it('reads a Windows path as its own folder rather than as one long name', () => {
    expect(projectPickerFolder(undefined, [madeIn('C:\\Users\\someone\\Projets\\Reel')])).toBe(
      'C:\\Users\\someone\\Projets',
    )
  })

  // A first launch has neither, and the system opening where it likes is the right answer then.
  it('answers nothing when there is no preference and no project yet', () => {
    expect(projectPickerFolder(undefined, [])).toBeUndefined()
  })
})
