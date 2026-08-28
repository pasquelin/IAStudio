import { appendFile, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MEMORY_VERSION, type MemoryDraft } from '@shared/domain/assistantMemory'
import type { SqliteDriver } from '@main/project/sqlite'
import { openMemoryDatabase } from '@main/project/sqliteMemory'
import { createMemoryIndex } from './memoryIndex'
import { createMemoryStore, hasMoved, type MemoryStore } from './memoryStore'
import { parseMemoryId, parseMemoryPatch } from './validation'

const draft = (fields: Partial<MemoryDraft> = {}): MemoryDraft => ({
  type: 'decision',
  summary: 'Cameras follow the rail',
  importance: 3,
  source: { kind: 'person' },
  ...fields,
})

let root: string
let file: string
let store: MemoryStore
let database: SqliteDriver
let minted: number

const open = (): MemoryStore => {
  minted = 0
  database = openMemoryDatabase()
  return createMemoryStore({
    file,
    index: createMemoryIndex(database),
    now: () => '2026-08-28T10:00:00.000Z',
    newId: () => `m_${++minted}`,
  })
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'ia-studio-memory-'))
  file = join(root, '.ia-studio', 'memory.ndjson')
  store = open()
})

afterEach(async () => {
  database.close()
  await rm(root, { recursive: true, force: true })
})

const lines = async (): Promise<unknown[]> =>
  (await readFile(file, 'utf8'))
    .split('\n')
    .filter(line => line.trim().length > 0)
    .map(line => JSON.parse(line))

describe('remembering something', () => {
  it('answers the memory it made, id and date included', async () => {
    const memory = await store.remember(draft())

    expect(memory).toEqual({
      id: 'm_1',
      type: 'decision',
      summary: 'Cameras follow the rail',
      body: '',
      importance: 3,
      createdAt: '2026-08-28T10:00:00.000Z',
      source: { kind: 'person' },
      refs: [],
      links: [],
      state: 'live',
    })
  })

  it('writes one line carrying the format version', async () => {
    await store.remember(draft())

    expect(await lines()).toEqual([expect.objectContaining({ v: MEMORY_VERSION, id: 'm_1' })])
  })

  it('makes the folder rather than failing on a project that has none', async () => {
    await store.remember(draft())

    expect(await lines()).toHaveLength(1)
  })

  it('finds it again by its words straight away', async () => {
    await store.remember(draft({ summary: 'La caméra suit le rail taillé' }))

    expect((await store.list({ text: 'camera taille' })).map(one => one.id)).toEqual(['m_1'])
  })
})

describe('surviving a restart', () => {
  /** 🛑 The whole point of the file: the index is thrown away, this is not. */
  it('reads back what a previous session wrote, index and all', async () => {
    await store.remember(draft({ summary: 'first' }))
    await store.remember(draft({ summary: 'second' }))
    await store.close()

    store = open()
    expect(await store.rebuild()).toBe(2)
    expect((await store.list({})).map(one => one.summary)).toEqual(
      expect.arrayContaining(['first', 'second']),
    )
  })

  it('reads the file again once it has moved', async () => {
    await store.remember(draft({ summary: 'first' }))
    expect(await store.refresh()).toBe(1)

    await store.remember(draft({ summary: 'second' }))

    expect(await store.refresh()).toBe(2)
  })

  it('opens a project that never remembered anything', async () => {
    expect(await store.rebuild()).toBe(0)
    expect(store.trouble()).toBeNull()
  })

  /**
   * 🛑 A memory written three times is held once, as its LAST line describes it. Without this the
   * file would answer three memories of one, and a correction would never take.
   */
  it('lets the last line about a memory win', async () => {
    await store.remember(draft({ summary: 'the first thing said' }))
    await store.amend('m_1', { summary: 'what it really was' })
    await store.close()

    store = open()
    expect(await store.rebuild()).toBe(1)
    expect((await store.read('m_1'))?.summary).toBe('what it really was')
  })

  it('leaves out what was dropped', async () => {
    await store.remember(draft())
    await store.forget('m_1')
    await store.close()

    store = open()
    expect(await store.rebuild()).toBe(0)
  })

  /**
   * 🛑 One JSON object per line is what buys this: an array would lose every memory after the
   * damaged byte, where here a broken line costs that memory alone.
   */
  it('keeps every good line around a broken one', async () => {
    await store.remember(draft({ summary: 'before' }))
    await appendFile(file, '{ this is not json\n', 'utf8')
    await store.remember(draft({ summary: 'after' }))
    await store.close()

    store = open()
    expect(await store.rebuild()).toBe(2)
    expect(store.trouble()).toBe('unreadable')
  })

  /**
   * 🛑 Set aside, never rewritten: the file is the person's, and a build that cannot read a line
   * must not be the build that deletes it.
   */
  it('leaves a line from a later studio in the file and says so', async () => {
    await store.remember(draft({ summary: 'ours' }))
    await appendFile(file, `${JSON.stringify({ v: MEMORY_VERSION + 1, id: 'm_future' })}\n`, 'utf8')
    await store.close()

    store = open()
    expect(await store.rebuild()).toBe(1)
    expect(store.trouble()).toBe('too-new')
    expect(await lines()).toHaveLength(2)
  })

  it('refuses a line whose summary is not a summary at all', async () => {
    await mkdir(dirname(file), { recursive: true })
    await appendFile(file, `${JSON.stringify({ v: MEMORY_VERSION, id: 'm_x' })}\n`, 'utf8')

    expect(await store.rebuild()).toBe(0)
    expect(store.trouble()).toBe('unreadable')
  })
})

describe('deciding whether the file has moved', () => {
  const stamp = { bytes: 120, modifiedAt: 1000 }

  /**
   * 🛑 Tested as a decision rather than through a rewritten file: putting an mtime back is not
   * something APFS allows — `utimes` rounds the fractional `mtimeMs` a `stat` hands out, and the
   * stamp moved by one, measured, in both directions from one run to the next.
   */
  it('has moved when the index has never read it', () => {
    expect(hasMoved(null, stamp)).toBe(true)
  })

  it('has moved when the file is gone', () => {
    expect(hasMoved(stamp, null)).toBe(true)
  })

  it('has moved on another size, and on another moment', () => {
    expect(hasMoved(stamp, { ...stamp, bytes: 121 })).toBe(true)
    expect(hasMoved(stamp, { ...stamp, modifiedAt: 1001 })).toBe(true)
  })

  /**
   * 🛑 The blind spot, written rather than hidden: a rewrite of the same size within the same
   * millisecond reads as untouched. Nothing the studio does lands there — the file only grows
   * between compactions, and a compaction changes its size.
   */
  it('reads a same-size rewrite of the same moment as untouched', () => {
    expect(hasMoved(stamp, { ...stamp })).toBe(false)
  })
})

describe('changing what a memory says', () => {
  it('answers nothing for a memory it does not hold', async () => {
    expect(await store.amend('m_gone', { summary: 'x' })).toBeNull()
  })

  /**
   * 🛑 Measured before it was fixed: zod KEEPS a key sent as an explicit `undefined`, and
   * structured clone carries it over the boundary. The spread then wrote a summary-less line to
   * the append-only file and threw on binding it — the amendment lost, and every later read of
   * that project answering `trouble: 'unreadable'` for good. `parseMemoryPatch` strips them now.
   */
  it('ignores a field sent as an explicit nothing rather than writing it', async () => {
    await store.remember(draft({ summary: 'held' }))
    await store.amend('m_1', parseMemoryPatch({ summary: undefined, state: 'archived' }))

    expect(await store.read('m_1')).toEqual(
      expect.objectContaining({ summary: 'held', state: 'archived' }),
    )
    expect(await store.rebuild()).toBe(1)
    expect(store.trouble()).toBeNull()
  })

  /**
   * 🛑 A COERCION is not a check: `String(undefined)` reads back as the string "undefined" and
   * `String({})` as "[object Object]", so a window sending nothing at all asked the store about a
   * memory named after its own mistake. The three id-taking channels went through `String`.
   */
  it('refuses an id that is not one, rather than coercing it into a name', () => {
    expect(() => parseMemoryId(undefined)).toThrow()
    expect(() => parseMemoryId({})).toThrow()
    expect(() => parseMemoryId('')).toThrow()
    expect(parseMemoryId('m_1')).toBe('m_1')
  })

  it('writes the whole memory again rather than a difference', async () => {
    await store.remember(draft())
    await store.amend('m_1', { state: 'pinned' })

    const written = await lines()
    expect(written).toHaveLength(2)
    expect(written[1]).toEqual(expect.objectContaining({ id: 'm_1', state: 'pinned' }))
  })

  it('keeps the id, the date and the source beyond what a caller may set', async () => {
    await store.remember(draft())
    const amended = await store.amend('m_1', { summary: 'reworded' })

    expect(amended).toEqual(
      expect.objectContaining({
        id: 'm_1',
        createdAt: '2026-08-28T10:00:00.000Z',
        source: { kind: 'person' },
        summary: 'reworded',
      }),
    )
  })
})

describe('what this machine served', () => {
  /**
   * 🛑 `usedAt` says when THIS machine last answered with a memory, so it stays out of a file
   * that travels — and a rebuild has to carry it across, or the next write by any window would
   * throw away every reading the retrieval had made.
   */
  it('never travels in the file, and survives a rebuild all the same', async () => {
    await store.remember(draft())
    await store.markUsed(['m_1'])

    expect((await lines())[0]).not.toHaveProperty('usedAt')
    expect((await store.read('m_1'))?.usedAt).toBe('2026-08-28T10:00:00.000Z')

    await store.rebuild()
    expect((await store.read('m_1'))?.usedAt).toBe('2026-08-28T10:00:00.000Z')
  })
})

describe('forgetting', () => {
  it('says so when there was nothing to forget', async () => {
    expect(await store.forget('m_gone')).toBe(false)
  })

  it('stops answering it, and writes down that it is gone', async () => {
    await store.remember(draft())
    expect(await store.forget('m_1')).toBe(true)

    expect(await store.read('m_1')).toBeNull()
    expect((await lines())[1]).toEqual(expect.objectContaining({ id: 'm_1', state: 'dropped' }))
  })
})

describe('resetting a project memory', () => {
  it('leaves no file and no memory behind', async () => {
    await store.remember(draft())
    await store.reset()

    expect(await store.list({})).toEqual([])
    await expect(readFile(file, 'utf8')).rejects.toThrow()
  })
})

describe('what a memory replaces', () => {
  const scriptDraft = (summary: string): MemoryDraft => ({
    type: 'script',
    summary,
    importance: 4,
    source: { kind: 'action', ref: 'script.write' },
    refs: [{ kind: 'file', ref: 'Scripts/Cam.ts' }],
  })

  /**
   * 🛑 A rule fires again on the same script. Two memories saying different things about one
   * file, with nothing to tell which is now, would both be recalled.
   */
  it('supersedes the one standing on the same reference, and archives it', async () => {
    const first = await store.remember(scriptDraft('the rig drives the rail'))
    const second = await store.remember(scriptDraft('the rig drives the rail and the target'))

    expect(second.supersedes).toBe(first.id)
    expect((await store.read(first.id))?.state).toBe('archived')
    expect((await store.list({ states: ['live'] })).map(one => one.summary)).toEqual([
      'the rig drives the rail and the target',
    ])
  })

  it('survives a restart, with the replaced one still archived', async () => {
    const first = await store.remember(scriptDraft('one'))
    await store.remember(scriptDraft('two'))
    await store.rebuild()

    expect((await store.read(first.id))?.state).toBe('archived')
    expect((await store.list({ states: ['live'] })).map(one => one.summary)).toEqual(['two'])
  })

  it('replaces nothing when it is about another file', async () => {
    await store.remember(scriptDraft('one'))
    const other = await store.remember({
      ...scriptDraft('two'),
      refs: [{ kind: 'file', ref: 'Scripts/Other.ts' }],
    })

    expect(other.supersedes).toBeUndefined()
    expect(await store.list({ states: ['live'] })).toHaveLength(2)
  })

  /** A memory anchored on nothing has nothing to be the same as: it is simply another one. */
  it('replaces nothing when the draft names no reference', async () => {
    const draft: MemoryDraft = {
      type: 'decision',
      summary: 'a decision recorded in git',
      importance: 3,
      source: { kind: 'action', ref: 'git.commit' },
    }
    await store.remember(draft)
    const second = await store.remember(draft)

    expect(second.supersedes).toBeUndefined()
    expect(await store.list({ states: ['live'] })).toHaveLength(2)
  })

  it('replaces nothing of another type on the same file', async () => {
    await store.remember(scriptDraft('one'))
    const other = await store.remember({ ...scriptDraft('two'), type: 'problem' })

    expect(other.supersedes).toBeUndefined()
  })
})

describe('compacting the file', () => {
  const readLines = async (): Promise<readonly string[]> =>
    (await readFile(file, 'utf8')).split('\n').filter(line => line.trim().length > 0)

  it('leaves one line per memory that still stands', async () => {
    const first = await store.remember(draft({ summary: 'one' }))
    await store.amend(first.id, { summary: 'one, said better' })
    await store.remember(draft({ summary: 'two' }))

    expect(await readLines()).toHaveLength(3)
    await expect(store.compact()).resolves.toBe(1)

    const lines = await readLines()
    expect(lines).toHaveLength(2)
    expect(lines.join('\n')).toContain('one, said better')
  })

  /**
   * 🛑 The one gesture that loses anything, and it loses only what was already forgotten:
   * archiving is a state, forgetting is a removal, and this is what carries the second out.
   */
  it('drops what was forgotten and keeps what was archived', async () => {
    const gone = await store.remember(draft({ summary: 'forgotten' }))
    const kept = await store.remember(draft({ summary: 'archived' }))
    await store.forget(gone.id)
    await store.amend(kept.id, { state: 'archived' })
    await store.compact()

    const body = (await readLines()).join('\n')
    expect(body).not.toContain('forgotten')
    expect(body).toContain('archived')
  })

  it('reads back the same memories after a restart', async () => {
    await store.remember(draft({ summary: 'one' }))
    await store.remember(draft({ summary: 'two' }))
    await store.compact()

    database.close()
    store = open()
    await store.rebuild()

    expect((await store.list({})).map(one => one.summary).sort()).toEqual(['one', 'two'])
  })

  it('saves nothing on a file that was never written', async () => {
    await expect(store.compact()).resolves.toBe(0)
  })
})

describe('what compaction refuses to touch', () => {
  /**
   * 🛑 A line a NEWER studio wrote is deliberately kept out of the index. Rewriting the file
   * from the index would erase it — and this is the one gesture that rewrites.
   */
  it('refuses a file it could not read whole, and leaves every line standing', async () => {
    await store.remember(draft({ summary: 'readable' }))
    await appendFile(file, `${JSON.stringify({ v: MEMORY_VERSION + 1, id: 'm_future' })}\n`)
    await store.rebuild()

    expect(store.trouble()).toBe('too-new')
    await expect(store.compact()).resolves.toBe(0)
    expect(await readFile(file, 'utf8')).toContain('m_future')
  })

  it('refuses a file that would not read at all, rather than emptying it', async () => {
    await store.remember(draft({ summary: 'held' }))
    await appendFile(file, 'this is not a line of json\n')
    await store.rebuild()

    expect(store.trouble()).toBe('unreadable')
    await expect(store.compact()).resolves.toBe(0)
    expect(await readFile(file, 'utf8')).toContain('held')
  })
})

describe('what a memory may not replace', () => {
  const pinnedDraft = (summary: string): MemoryDraft => ({
    type: 'script',
    summary,
    importance: 4,
    source: { kind: 'action', ref: 'script.write' },
    refs: [{ kind: 'file', ref: 'Scripts/Cam.ts' }],
  })

  /**
   * 🛑 Pinning IS the decision to always give it. An automatic rule archiving it would undo that
   * decision without a word — the same invariant `staleIn` holds for the upkeep.
   */
  it('never supersedes a pinned memory', async () => {
    const pinned = await store.remember({ ...pinnedDraft('the rail'), state: 'pinned' })
    const second = await store.remember(pinnedDraft('the rail and the target'))

    expect(second.supersedes).toBeUndefined()
    expect((await store.read(pinned.id))?.state).toBe('pinned')
  })
})
