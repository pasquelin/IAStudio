import { describe, expect, it } from 'vitest'
import {
  listedAt,
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
