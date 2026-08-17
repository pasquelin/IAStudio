import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, onTestFinished } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import { createCatalog } from './catalog'
import { ITEMS_BACKUP, itemsBackupOf, writeItemsBackup } from './itemsBackup'
import { openMemoryDatabase } from './sqliteMemory'

const WRITTEN_AT = '2026-08-17T10:00:00.000Z'

const asset = (over: Partial<Asset> & { id: string }): Asset => ({
  name: over.id,
  type: 'image',
  location: 'local',
  tags: [],
  createdAt: '2026-08-01T10:00:00.000Z',
  ...over,
})

describe('what the catalogue puts in the backup', () => {
  /**
   * Provenance and nothing else. The proxy, the waveform and the poster are rebuildable from the
   * file, and everything about the remote twin belongs to an account rather than to a project —
   * what only this file can answer is what the bytes were called and what was asked for.
   */
  it('keeps what a file cannot say about itself', () => {
    const catalog = createCatalog(openMemoryDatabase())
    onTestFinished(catalog.close)
    catalog.add(
      asset({
        id: 'a',
        name: 'Ruelle bleue',
        path: 'Images/ruelle.png',
        hash: 'h1',
        tags: ['final', 'hero'],
        generation: {
          modelId: 'flux',
          modelLabel: 'Flux',
          prompt: 'une ruelle bleue',
          params: {},
          seed: 42,
        },
      }),
    )

    expect(catalog.backup()).toEqual([
      {
        hash: 'h1',
        id: 'a',
        name: 'Ruelle bleue',
        type: 'image',
        path: 'Images/ruelle.png',
        createdAt: '2026-08-01T10:00:00.000Z',
        tags: ['final', 'hero'],
        prompt: 'une ruelle bleue',
        modelId: 'flux',
        seed: 42,
      },
    ])
  })

  // The key IS the fingerprint: a row with none cannot be looked up in this file at all, so
  // writing it would be writing a list with an entry nobody can reach.
  it('leaves out a row with no fingerprint, and one with no file', () => {
    const catalog = createCatalog(openMemoryDatabase())
    onTestFinished(catalog.close)
    catalog.add(asset({ id: 'a', path: 'Images/one.png' }))
    catalog.add(asset({ id: 'b', hash: 'h2' }))
    catalog.add(asset({ id: 'c', path: 'Images/three.png', hash: 'h3' }))

    expect(catalog.backup().map(row => row.id)).toEqual(['c'])
  })
})

describe('the backup file', () => {
  it('is keyed by fingerprint, which is what a lost catalogue is looked up by', () => {
    const backup = itemsBackupOf(
      [
        {
          hash: 'h1',
          id: 'a',
          name: 'Ruelle',
          type: 'image',
          path: 'Images/ruelle.png',
          createdAt: '2026-08-01T10:00:00.000Z',
          tags: [],
        },
      ],
      WRITTEN_AT,
    )

    expect(Object.keys(backup.items)).toEqual(['h1'])
    expect(backup.writtenAt).toBe(WRITTEN_AT)
  })

  /**
   * Atomic, because this is exactly the file a half-write makes useless: it is read when the
   * database is already gone, so a truncated one would be the second loss after the first.
   */
  it('lands under a dot, whole, and leaves no staging copy behind', async () => {
    const root = await mkdtemp(join(tmpdir(), 'scenario-backup-'))
    onTestFinished(() => rm(root, { recursive: true, force: true }))

    await writeItemsBackup(root, itemsBackupOf([], WRITTEN_AT))

    const written: unknown = JSON.parse(await readFile(join(root, ITEMS_BACKUP), 'utf8'))
    expect(written).toEqual({ version: 1, writtenAt: WRITTEN_AT, items: {} })
    await expect(readFile(`${join(root, ITEMS_BACKUP)}.staging`, 'utf8')).rejects.toThrow()
  })
})
