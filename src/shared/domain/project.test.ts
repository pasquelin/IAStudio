import { describe, expect, it } from 'vitest'
import { RECENT_PROJECTS_MAX, withRecentProject, type Project, type RecentProject } from './project'

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
  it('puts it first, which is the order the shelf reads', () => {
    const list = withRecentProject(recent(3), project('/projects/new'), '2026-08-08T10:00:00Z')

    expect(list[0]).toEqual({
      path: '/projects/new',
      name: '/projects/new',
      openedAt: '2026-08-08T10:00:00Z',
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
