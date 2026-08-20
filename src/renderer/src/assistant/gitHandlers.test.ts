import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ACTION_REGISTRY, commitmentOfCall, needsConfirmation } from '@shared/domain/assistant'
import type { GitRepository } from '@shared/domain/git'
import type { GitDiff } from '@shared/domain/gitDiff'
import { installFakeBridge } from '@/services/fakeBridge'
import { gitReadyRepository } from '@/stores/git-fixtures'
import { runAction } from './executor'

const READY = gitReadyRepository({ head: 'abc123' })

beforeEach(() => {
  installFakeBridge()
})

describe('reading the repository', () => {
  it('answers the panel’s own state, no project included', async () => {
    installFakeBridge({ git: { read: vi.fn(async () => READY) } })
    expect(await runAction('git.status', {})).toEqual({ ok: true, data: READY })

    const none: GitRepository = { kind: 'no-project' }
    installFakeBridge({ git: { read: vi.fn(async () => none) } })
    // Not a refusal: "this project records no versions" is an answer, and the client needs it to
    // know whether to offer `git.init`.
    expect(await runAction('git.status', {})).toEqual({ ok: true, data: none })
  })

  it('pages the history, and asks for a default page when given none', async () => {
    const log = vi.fn(async () => [])
    installFakeBridge({ git: { log } })

    await runAction('git.log', { limit: 5, skip: 10 })
    expect(log).toHaveBeenCalledWith(5, 10)

    await runAction('git.log', {})
    expect(log).toHaveBeenLastCalledWith(20, 0)
  })

  /**
   * `null` is the working tree against the last recorded version — which is what a client that
   * named no version means, not a missing argument.
   */
  it('diffs against the last version when no version is named', async () => {
    const empty: GitDiff = { kind: 'text', hunks: [] }
    const diff = vi.fn(async () => empty)
    installFakeBridge({ git: { diff } })

    await runAction('git.diff', { path: 'a.txt' })
    expect(diff).toHaveBeenCalledWith('a.txt', null)

    await runAction('git.diff', { path: 'a.txt', commit: 'abc123' })
    expect(diff).toHaveBeenLastCalledWith('a.txt', 'abc123')
  })
})

describe('changing the repository', () => {
  it('stages, unstages and restores the paths it was given', async () => {
    const stage = vi.fn(async () => READY)
    const unstage = vi.fn(async () => READY)
    const restore = vi.fn(async () => READY)
    installFakeBridge({ git: { stage, unstage, restore } })

    await runAction('git.stage', { paths: ['a.txt', 'b.txt'] })
    await runAction('git.unstage', { paths: ['a.txt'] })
    await runAction('git.restore', { paths: ['b.txt'] })

    expect(stage).toHaveBeenCalledWith(['a.txt', 'b.txt'])
    expect(unstage).toHaveBeenCalledWith(['a.txt'])
    expect(restore).toHaveBeenCalledWith(['b.txt'])
  })

  it('refuses an empty list rather than calling git with one', async () => {
    const stage = vi.fn(async () => READY)
    installFakeBridge({ git: { stage } })

    expect(await runAction('git.stage', { paths: [] })).toEqual({
      ok: false,
      refusal: 'badInput',
    })
    expect(stage).not.toHaveBeenCalled()
  })

  // Every write answers with the state it LEFT — the panel's own contract — so a client never
  // has to read the status back, and two calls cannot disagree about what the tree holds.
  it('answers each write with the state git was left in', async () => {
    installFakeBridge({ git: { commit: vi.fn(async () => READY) } })

    expect(await runAction('git.commit', { message: 'Un lot' })).toEqual({ ok: true, data: READY })
  })

  it('amends only when asked to', async () => {
    const commit = vi.fn(async () => READY)
    installFakeBridge({ git: { commit } })

    await runAction('git.commit', { message: 'Un lot' })
    expect(commit).toHaveBeenCalledWith('Un lot', false)

    await runAction('git.commit', { message: 'Un lot', amend: true })
    expect(commit).toHaveBeenLastCalledWith('Un lot', true)
  })

  it('branches, checks out, tags and shelves through their own channels', async () => {
    const createBranch = vi.fn(async () => READY)
    const checkout = vi.fn(async () => READY)
    const tag = vi.fn(async () => READY)
    const stash = vi.fn(async () => READY)
    const stashPop = vi.fn(async () => READY)
    installFakeBridge({ git: { createBranch, checkout, tag, stash, stashPop } })

    await runAction('git.createBranch', { name: 'feat/x' })
    await runAction('git.checkout', { name: 'main' })
    await runAction('git.tag', { name: 'v1', commit: 'abc123' })
    await runAction('git.stash', { message: 'en cours' })
    await runAction('git.stashPop', { index: 0 })

    expect(createBranch).toHaveBeenCalledWith('feat/x')
    expect(checkout).toHaveBeenCalledWith('main')
    expect(tag).toHaveBeenCalledWith('v1', 'abc123')
    expect(stash).toHaveBeenCalledWith('en cours')
    expect(stashPop).toHaveBeenCalledWith(0)
  })

  it('settles a conflict on one side, and refuses a side that is neither', async () => {
    const resolve = vi.fn(async () => READY)
    installFakeBridge({ git: { resolve } })

    await runAction('git.resolve', { paths: ['a.png'], side: 'theirs' })
    expect(resolve).toHaveBeenCalledWith(['a.png'], 'theirs')

    expect(await runAction('git.resolve', { paths: ['a.png'], side: 'mine' })).toEqual({
      ok: false,
      refusal: 'badInput',
    })
  })

  it('reaches the remote through its own three channels', async () => {
    const fetch = vi.fn(async () => READY)
    const pull = vi.fn(async () => READY)
    const push = vi.fn(async () => READY)
    const addRemote = vi.fn(async () => READY)
    installFakeBridge({ git: { fetch, pull, push, addRemote } })

    await runAction('git.fetch', {})
    await runAction('git.pull', {})
    await runAction('git.push', { setUpstream: true })
    await runAction('git.addRemote', { name: 'origin', url: 'git@host:repo.git' })

    expect(fetch).toHaveBeenCalled()
    expect(pull).toHaveBeenCalled()
    expect(push).toHaveBeenCalledWith(true)
    expect(addRemote).toHaveBeenCalledWith('origin', 'git@host:repo.git')
  })
})

/**
 * The grading is the whole of what these three are about: `fetch` takes nothing back because it
 * gives nothing away, `pull` rewrites the working copy exactly as `checkout` does, and `push`
 * leaves the machine — the one level no undo here reaches.
 */
describe('what reaching the remote engages', () => {
  it('asks nothing for a fetch, files for a pull, and the remote level for a push', () => {
    expect(commitmentOfCall('git.fetch', {})).toBe('none')
    expect(commitmentOfCall('git.pull', {})).toBe('files')
    expect(commitmentOfCall('git.push', {})).toBe('remote')
    expect(needsConfirmation('remote')).toBe(true)
  })

  // A secret the renderer may not read back is one an outside client may not probe either.
  it('publishes no credential channel at all', () => {
    const names = ACTION_REGISTRY.map(entry => entry.name)

    expect(names.filter(name => name.toLowerCase().includes('credential'))).toEqual([])
  })
})
