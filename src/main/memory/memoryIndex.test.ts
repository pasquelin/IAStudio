import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Memory } from '@shared/domain/assistantMemory'
import type { SqliteDriver } from '@main/project/sqlite'
import { openMemoryDatabase } from '@main/project/sqliteMemory'
import { createMemoryIndex, type MemoryIndex } from './memoryIndex'
import { digestOf, embeddedTextOf, type MemoryVector } from './vectors'

const memory = (fields: Partial<Memory> = {}): Memory => ({
  id: 'm_one',
  type: 'decision',
  summary: 'Cameras follow the rail',
  body: '',
  importance: 3,
  createdAt: '2026-08-28T10:00:00.000Z',
  source: { kind: 'person' },
  refs: [],
  links: [],
  state: 'live',
  ...fields,
})

let database: SqliteDriver
let index: MemoryIndex

beforeEach(() => {
  database = openMemoryDatabase()
  index = createMemoryIndex(database)
})

afterEach(() => database.close())

describe('holding a memory', () => {
  it('reads back everything it was given, refs and links included', () => {
    const written = memory({
      body: 'the rail was chosen so a shot repeats',
      usedAt: '2026-08-28T11:00:00.000Z',
      source: { kind: 'action', ref: 'scene.rail.create' },
      // Held in the order the index answers in — sorted, never the order they were written.
      refs: [
        { kind: 'file', ref: 'Scripts/Cam.ts' },
        { kind: 'scene', ref: 's_1' },
      ],
      links: ['m_two'],
      state: 'pinned',
      supersedes: 'm_old',
    })
    index.put(written)

    expect(index.read('m_one')).toEqual(written)
  })

  it('answers nothing for an id it never saw', () => {
    expect(index.read('m_gone')).toBeNull()
  })

  /**
   * 🛑 One line of the file is the whole truth about one memory. Merging would leave a ref that
   * its author removed, and nothing would ever say where it came from.
   */
  it('replaces the refs of a memory rather than adding to them', () => {
    index.put(memory({ refs: [{ kind: 'scene', ref: 's_1' }] }))
    index.put(memory({ refs: [{ kind: 'file', ref: 'Scripts/Cam.ts' }] }))

    expect(index.read('m_one')?.refs).toEqual([{ kind: 'file', ref: 'Scripts/Cam.ts' }])
  })

  /**
   * 🛑 Read through the fts5 table itself, and it has to be: `list` joins on `memories`, so a
   * dead row answers nothing and every other case here stayed green on the defect. Measured —
   * `INSERT OR REPLACE` fires no `AFTER DELETE` trigger, so the corpus grew by one on every
   * amend and bm25 came to rank against ghosts. `integrity-check` reported nothing either.
   */
  it('forgets the words of the version it replaced', () => {
    index.put(memory({ summary: 'zebra crossing' }))
    index.put(memory({ summary: 'giraffe walking' }))

    expect(database.prepare('SELECT count(*) AS held FROM memories_fts').get()?.held).toBe(1)
    expect(
      database.prepare("SELECT rowid FROM memories_fts WHERE memories_fts MATCH 'zebra'").all(),
    ).toEqual([])
  })

  it('keeps a link to a memory it has never read', () => {
    index.put(memory({ links: ['m_not_here_yet'] }))

    expect(index.read('m_one')?.links).toEqual(['m_not_here_yet'])
  })
})

describe('finding a memory by its words', () => {
  beforeEach(() => {
    index.putAll([
      memory({ id: 'm_rail', summary: 'La caméra suit le rail taillé' }),
      memory({ id: 'm_sprint', summary: 'PlayerController.ts holds the sprint' }),
      memory({ id: 'm_light', summary: 'The key light stays at 45 degrees', body: 'sprint' }),
    ])
  })

  /** 🛑 The whole reason for `remove_diacritics 2`: nobody types accents into a search box. */
  it('finds an accented word typed without its accent', () => {
    expect(index.list({ text: 'camera taille' }).map(one => one.id)).toEqual(['m_rail'])
  })

  it('finds a file name whole, which is what an exact search is for', () => {
    expect(index.list({ text: 'PlayerController.ts' }).map(one => one.id)).toContain('m_sprint')
  })

  it('searches the body as well as the summary', () => {
    expect(index.list({ text: 'sprint' }).map(one => one.id)).toEqual(
      expect.arrayContaining(['m_sprint', 'm_light']),
    )
  })

  /**
   * 🛑 Punctuation alone tokenises to nothing, and fts5 cannot look for what it never indexed.
   * Without the fallback, searching « 45% » answers that nothing matched.
   */
  it('falls back to a scan when nothing tokenises', () => {
    index.put(memory({ id: 'm_odd', summary: 'weight is 45%' }))

    expect(index.list({ text: '%' }).map(one => one.id)).toEqual(['m_odd'])
  })

  it('answers an empty list rather than everything when nothing matches', () => {
    expect(index.list({ text: 'submarine' })).toEqual([])
  })
})

describe('narrowing a listing', () => {
  beforeEach(() => {
    index.putAll([
      memory({ id: 'm_a', type: 'decision', state: 'live', importance: 5 }),
      memory({ id: 'm_b', type: 'script', state: 'archived', importance: 1 }),
      memory({
        id: 'm_c',
        type: 'script',
        state: 'live',
        importance: 3,
        refs: [{ kind: 'scene', ref: 's_1' }],
      }),
    ])
  })

  it('keeps only the types asked for', () => {
    expect(index.list({ types: ['script'] }).map(one => one.id)).toEqual(['m_c', 'm_b'])
  })

  it('keeps only the states asked for', () => {
    expect(index.list({ states: ['live'] }).map(one => one.id)).toEqual(['m_a', 'm_c'])
  })

  it('anchors on what is in front of the person', () => {
    expect(index.list({ refs: [{ kind: 'scene', ref: 's_1' }] }).map(one => one.id)).toEqual([
      'm_c',
    ])
  })

  it('ranks by weight when no words were asked for', () => {
    expect(index.list({}).map(one => one.id)).toEqual(['m_a', 'm_c', 'm_b'])
  })

  it('answers at most what it was asked for', () => {
    expect(index.list({ limit: 1 })).toHaveLength(1)
  })
})

describe('what the index believes the file to be', () => {
  it('has no opinion before it is told', () => {
    expect(index.stamp()).toBeNull()
  })

  it('holds one stamp, not a history of them', () => {
    index.restamp({ bytes: 120, modifiedAt: 1 })
    index.restamp({ bytes: 240, modifiedAt: 2 })

    expect(index.stamp()).toEqual({ bytes: 240, modifiedAt: 2 })
  })
})

describe('emptying it for a rebuild', () => {
  /**
   * 🛑 The rows go through `memories` so the fts5 triggers fire. Emptied around them, the index
   * would keep every word it ever read and answer searches about memories that are gone.
   */
  it('forgets the words as well as the rows', () => {
    index.put(memory({ summary: 'a memorable sentence' }))
    index.clear()

    expect(index.list({ text: 'memorable' })).toEqual([])
    expect(index.list({})).toEqual([])
    expect(index.stamp()).toBeNull()
  })

  it('is still usable afterwards', () => {
    index.put(memory())
    index.clear()
    index.put(memory({ id: 'm_new', summary: 'written after the wipe' }))

    expect(index.list({ text: 'wipe' }).map(one => one.id)).toEqual(['m_new'])
  })
})

describe('what a retrieval served', () => {
  it('stamps only the memories it names', () => {
    index.putAll([memory({ id: 'm_a' }), memory({ id: 'm_b' })])
    index.markUsed(['m_a'], '2026-08-28T12:00:00.000Z')

    expect(index.read('m_a')?.usedAt).toBe('2026-08-28T12:00:00.000Z')
    expect(index.read('m_b')?.usedAt).toBeUndefined()
  })
})

describe('the embeddings beside the memories', () => {
  const vectorOf = (memoryId: string, values: readonly number[], digest: string): MemoryVector => ({
    memoryId,
    model: 'e',
    digest,
    values: new Float32Array(values),
  })

  const digestFor = (one: Memory): string => digestOf(embeddedTextOf(one.summary, one.body))

  /**
   * 🛑 The table itself, never `vectors()`. That reader JOINs on `memories`, so an orphan it left
   * behind reads as absent through it — a test written the obvious way passes WITH the leak.
   */
  const rowsHeld = (): number =>
    Number(database.prepare('SELECT count(*) AS held FROM memory_vectors').get()?.['held'] ?? -1)

  it('gives back the floats it was handed, through the blob', () => {
    const written = memory({ summary: 'a sentence with a vector' })
    index.put(written)
    index.writeVectors([vectorOf('m_one', [0.5, -0.25, 0], digestFor(written))])

    expect([...(index.vectors('e')[0]?.values ?? [])]).toEqual([0.5, -0.25, 0])
  })

  it('names what still has none, and stops naming it once it has one', () => {
    const written = memory()
    index.put(written)

    expect(index.pendingVectors('e')).toBe(1)
    expect(index.withoutVector('e', 10).map(one => one.id)).toEqual(['m_one'])

    index.writeVectors([vectorOf('m_one', [1], digestFor(written))])

    expect(index.pendingVectors('e')).toBe(0)
    expect(index.withoutVector('e', 10)).toEqual([])
  })

  it('embeds both halves of a memory, not the summary alone', () => {
    index.put(memory({ summary: 'the rail', body: 'Scripts/Cam.ts drives it' }))

    expect(index.withoutVector('e', 10)[0]?.text).toBe('the rail\nScripts/Cam.ts drives it')
  })

  /**
   * 🛑 The reason the table is keyed on a digest rather than on a row. Reading the file back
   * empties and rewrites `memories`, which is what an opening does whenever anything was
   * remembered since — and a vector costs 24 ms to make.
   */
  it('keeps a vector across a rebuild that rewrote the same memory', () => {
    const written = memory()
    index.put(written)
    index.writeVectors([vectorOf('m_one', [1], digestFor(written))])

    index.clear()
    index.putAll([written])

    expect(index.pendingVectors('e')).toBe(0)
    expect(index.vectors('e')).toHaveLength(1)
  })

  it('asks for a new one when the words changed, and stops answering the old one', () => {
    const written = memory()
    index.put(written)
    index.writeVectors([vectorOf('m_one', [1], digestFor(written))])

    index.put(memory({ summary: 'the cameras follow the target after all' }))

    expect(index.pendingVectors('e')).toBe(1)
    // Not merely « pending »: the stale vector must not be scored against a question either.
    expect(index.vectors('e')).toEqual([])
  })

  it('drops what another model produced, and keeps its own', () => {
    const written = memory()
    index.put(written)
    index.writeVectors([{ ...vectorOf('m_one', [1], digestFor(written)), model: 'old' }])

    index.dropOtherVectors('e')

    expect(index.vectors('old')).toEqual([])
    expect(index.pendingVectors('e')).toBe(1)
  })

  it('drops the vector of a memory that was forgotten', () => {
    const written = memory()
    index.put(written)
    index.writeVectors([vectorOf('m_one', [1], digestFor(written))])
    index.remove('m_one')

    expect(rowsHeld()).toBe(0)
  })

  /** `clear` spares them on purpose, so a memory the file dropped is only orphaned after. */
  it('sweeps the vectors of memories the file no longer holds', () => {
    const written = memory()
    index.put(written)
    index.writeVectors([vectorOf('m_one', [1], digestFor(written))])

    index.clear()
    index.putAll([memory({ id: 'm_other' })])

    expect(rowsHeld()).toBe(1)

    index.sweepVectors()

    expect(rowsHeld()).toBe(0)
  })
})

describe('what answers a question', () => {
  const NOW = '2026-08-28T12:00:00.000Z'
  const ask = (fields: Partial<Parameters<MemoryIndex['recall']>[0]> = {}): readonly Memory[] =>
    index.recall({ text: '', now: NOW, limit: 10, ...fields })

  const vectorFor = (one: Memory, values: readonly number[]): void =>
    index.writeVectors([
      {
        memoryId: one.id,
        model: 'e',
        digest: digestOf(embeddedTextOf(one.summary, one.body)),
        values: new Float32Array(values),
      },
    ])

  it('finds by an exact word what no vector could reach', () => {
    index.putAll([
      memory({ id: 'm_script', summary: 'Scripts/CameraRig.ts drives the rail' }),
      memory({ id: 'm_other', summary: 'the palette is night blue and ochre' }),
    ])

    expect(ask({ text: 'CameraRig' }).map(one => one.id)).toEqual(['m_script'])
  })

  /** The one voice that answers a question nobody can word exactly. */
  it('finds by meaning what the words missed', () => {
    const near = memory({ id: 'm_near', summary: 'we chose to export materials as MaterialX' })
    const far = memory({ id: 'm_far', summary: 'the forest GLB takes forty seconds to load' })
    index.putAll([near, far])
    vectorFor(near, [1, 0])
    vectorFor(far, [0, 1])

    const found = ask({
      text: 'nothing matches these words',
      question: new Float32Array([1, 0]),
      model: 'e',
    })

    expect(found[0]?.id).toBe('m_near')
  })

  it('answers on words alone when no model has embedded anything', () => {
    index.putAll([memory({ id: 'm_script', summary: 'Scripts/CameraRig.ts drives the rail' })])

    expect(ask({ text: 'CameraRig', model: 'e' }).map(one => one.id)).toEqual(['m_script'])
  })

  /** What is on screen is not a guess — see `RECALL_WEIGHTS`. */
  it('puts what the open document is anchored to ahead of a word that merely matched', () => {
    index.putAll([
      memory({ id: 'm_words', summary: 'the rail was rebuilt in the workshop' }),
      memory({
        id: 'm_here',
        summary: 'a note about nothing',
        refs: [{ kind: 'scene', ref: 's_1' }],
      }),
    ])

    const found = ask({ text: 'rail', refs: [{ kind: 'scene', ref: 's_1' }] })

    expect(found[0]?.id).toBe('m_here')
  })

  it('gives a pinned memory even when nothing about it was asked', () => {
    index.putAll([
      memory({ id: 'm_pinned', state: 'pinned', summary: 'always tell me about the client' }),
      memory({ id: 'm_words', summary: 'the rail was rebuilt' }),
    ])

    expect(ask({ text: 'rail' })[0]?.id).toBe('m_pinned')
  })

  /**
   * 🛑 Merged and not concatenated: a memory both voices found would otherwise be answered twice,
   * and the second copy would push a different memory out of the budget.
   */
  it('answers a memory once when the words and the meaning both found it', () => {
    const both = memory({ id: 'm_both', summary: 'the rail and the cameras' })
    index.put(both)
    vectorFor(both, [1, 0])

    const found = ask({ text: 'rail', question: new Float32Array([1, 0]), model: 'e' })

    expect(found.map(one => one.id)).toEqual(['m_both'])
  })

  it('answers nothing at all when nothing is held', () => {
    expect(ask({ text: 'rail' })).toEqual([])
  })

  /** A vector another model made is in another space: scoring against it is worse than not. */
  it('ignores the vectors of a model it was not asked about', () => {
    const one = memory({ id: 'm_one', summary: 'a memory with an old vector' })
    index.put(one)
    index.writeVectors([
      {
        memoryId: one.id,
        model: 'old',
        digest: digestOf(embeddedTextOf(one.summary, one.body)),
        values: new Float32Array([1, 0]),
      },
    ])

    // Found by nothing but its own presence, so the ranking never sees a similarity at all.
    expect(ask({ question: new Float32Array([1, 0]), model: 'e' })).toEqual([])
  })
})
