import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_TEXTURE_MATERIAL, MATERIAL_BOUNDS } from '@shared/domain/texture'
import type { MaterialStyle } from '@shared/domain/style'
import { createStyles, type StylesStore } from './store'

function draft(overrides: Partial<MaterialStyle> = {}): MaterialStyle {
  return {
    id: 'style_1',
    name: 'Style 1',
    createdAt: '2026-08-09T10:00:00.000Z',
    values: { ...DEFAULT_TEXTURE_MATERIAL, roughness: 0.2, metalness: 1 },
    ...overrides,
  }
}

let folder: string
let styles: StylesStore
let file: string

beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), 'styles-'))
  file = join(folder, 'styles.json')
  styles = createStyles(() => folder)
})

describe('the styles file', () => {
  it('answers an empty list before anything has been saved', async () => {
    await expect(styles.list()).resolves.toEqual([])
  })

  it('keeps what was saved, values and all', async () => {
    const [style] = await styles.save(draft())

    expect(style).toMatchObject({ id: 'style_1', name: 'Style 1' })
    expect(style?.values.roughness).toBe(0.2)
    expect(style?.values.metalness).toBe(1)
  })

  it('survives a reopening, which is the whole point of a style', async () => {
    await styles.save(draft())

    await expect(createStyles(() => folder).list()).resolves.toHaveLength(1)
  })

  it('renames without touching the values', async () => {
    await styles.save(draft())

    const [style] = await styles.rename('style_1', 'Brushed metal')

    expect(style?.name).toBe('Brushed metal')
    expect(style?.values.roughness).toBe(0.2)
  })

  it('leaves the list alone when renaming an id it does not hold', async () => {
    await styles.save(draft())

    await expect(styles.rename('style_404', 'Nothing')).resolves.toMatchObject([
      { name: 'Style 1' },
    ])
  })

  it('removes one and keeps the others', async () => {
    await styles.save(draft())
    await styles.save(draft({ id: 'style_2', name: 'Style 2' }))

    await expect(styles.remove('style_1')).resolves.toMatchObject([{ id: 'style_2' }])
  })

  /**
   * The user's own folder: a file edited by hand or restored from a backup must not empty the
   * panel. Unparseable is beyond recovery either way, and refusing would wedge it for good.
   */
  it('opens on an empty list rather than throwing on a file that is not JSON', async () => {
    await writeFile(file, 'not json at all', 'utf8')

    await expect(createStyles(() => folder).list()).resolves.toEqual([])
  })

  it('drops the one entry that does not parse, never the shelf with it', async () => {
    await writeFile(file, JSON.stringify([{ nonsense: true }, draft()]), 'utf8')

    await expect(createStyles(() => folder).list()).resolves.toMatchObject([{ id: 'style_1' }])
  })

  /**
   * The bound belongs to the value, not to the slider: a `roughness` of 12 reaches the GGX term
   * as a nonsense alpha. `readMaterial` already held a hand-edited `.mtlx` to the same rule.
   */
  it('holds a hand-edited value inside what the value means', async () => {
    // Both bounds differ from the default they would fall back to, so a style read as "nothing
    // at all" cannot pass this by landing on the defaults — which is how it first passed.
    const wild = { ...DEFAULT_TEXTURE_MATERIAL, metalness: 12, heightScale: 3 }
    await writeFile(file, JSON.stringify([{ ...draft(), values: wild }]), 'utf8')

    const [style] = await createStyles(() => folder).list()

    expect(style?.values.metalness).toBe(1)
    expect(style?.values.heightScale).toBe(MATERIAL_BOUNDS.heightScale.max)
    expect(DEFAULT_TEXTURE_MATERIAL.metalness).not.toBe(1)
    expect(DEFAULT_TEXTURE_MATERIAL.heightScale).not.toBe(MATERIAL_BOUNDS.heightScale.max)
  })

  it('fills a value the file never had rather than dropping the style', async () => {
    await writeFile(file, JSON.stringify([{ ...draft(), values: { roughness: 0.5 } }]), 'utf8')

    const [style] = await createStyles(() => folder).list()

    expect(style?.values.roughness).toBe(0.5)
    expect(style?.values.metalness).toBe(DEFAULT_TEXTURE_MATERIAL.metalness)
  })

  /** Written through a staging copy renamed into place, so a crash never truncates the list. */
  it('leaves no staging copy behind', async () => {
    await styles.save(draft())

    await expect(readFile(`${file}.staging`, 'utf8')).rejects.toThrow()
  })

  it('settles two saves racing into one list holding both', async () => {
    await Promise.all([styles.save(draft()), styles.save(draft({ id: 'style_2' }))])

    await expect(styles.list()).resolves.toHaveLength(2)
  })
})
