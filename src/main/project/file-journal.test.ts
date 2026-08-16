import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, onTestFinished } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import { PENDING_FILES_FILE } from '@shared/domain/project'
import { memoryCatalog } from './catalog-fixtures'
import { appendMove, applyJournal, replayMoves } from './file-journal'

const asset = (overrides: Partial<Asset> = {}): Asset => ({
  id: 'asset_1',
  name: 'A001',
  type: 'video',
  location: 'local',
  tags: [],
  createdAt: '2026-08-16T10:00:00.000Z',
  ...overrides,
})

describe('replayMoves', () => {
  it('reads back what was written, in the order it happened', () => {
    const body = '{"from":"a.png","to":"Art/a.png"}\n{"from":"b.png","to":"Art/b.png"}\n'
    expect(replayMoves(body)).toEqual([
      { from: 'a.png', to: 'Art/a.png' },
      { from: 'b.png', to: 'Art/b.png' },
    ])
  })

  /**
   * What an interrupted append actually leaves — and the reason the journal is a line per move
   * rather than one object. Refusing every move over the last half-written one would strand a
   * project the studio could have repaired.
   */
  it('keeps the moves before a line the machine cut in half', () => {
    const body = '{"from":"a.png","to":"Art/a.png"}\n{"from":"b.png","to":"Ar'
    expect(replayMoves(body)).toEqual([{ from: 'a.png', to: 'Art/a.png' }])
  })

  it('skips a line that parses but says nothing', () => {
    const body = '{"from":"a.png","to":"Art/a.png"}\n{"from":"","to":"x"}\n{"nope":1}\n[]\n'
    expect(replayMoves(body)).toEqual([{ from: 'a.png', to: 'Art/a.png' }])
  })
})

describe('the move journal on disk', () => {
  let root = ''

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'scenario-journal-'))
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('finishes a move a previous session did not, and takes the journal away', async () => {
    const catalog = memoryCatalog()
    onTestFinished(catalog.close)
    await catalog.add(asset({ path: 'Rushes/A001.mov' }))

    await appendMove(root, { from: 'Rushes', to: 'Footage' })
    const caught = await applyJournal(root, catalog)

    expect(caught).toBe(1)
    expect((await catalog.find('asset_1'))?.path).toBe('Footage/A001.mov')
    await expect(readFile(join(root, PENDING_FILES_FILE), 'utf8')).rejects.toThrow()
  })

  /**
   * Every opening replays without asking whether it should, so a journal describing work already
   * done has to leave the project alone — and take itself away rather than be read again.
   */
  it('leaves the project alone and clears a journal that is already spent', async () => {
    const catalog = memoryCatalog()
    onTestFinished(catalog.close)
    await catalog.add(asset({ path: 'Footage/A001.mov' }))

    await mkdir(join(root, '.index'), { recursive: true })
    await writeFile(join(root, PENDING_FILES_FILE), '{"from":"Rushes","to":"Footage"}\n', 'utf8')
    await applyJournal(root, catalog)

    expect((await catalog.find('asset_1'))?.path).toBe('Footage/A001.mov')
    await expect(readFile(join(root, PENDING_FILES_FILE), 'utf8')).rejects.toThrow()
  })

  it('says nothing happened when there is no journal at all', async () => {
    const catalog = memoryCatalog()
    onTestFinished(catalog.close)

    expect(await applyJournal(root, catalog)).toBe(0)
  })
})
