import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { defaultModelFolder, migrateSttFolder } from './modelStore'

const folderWith = (files: Readonly<Record<string, string>>): string => {
  const root = mkdtempSync(join(tmpdir(), 'models-'))
  mkdirSync(join(root, 'stt'), { recursive: true })
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(root, 'stt', name), content)
  }

  return root
}

describe('the model folder', () => {
  /**
   * `models/stt` named one model where the folder holds the whole catalogue — the recognition
   * model and every set of weights llama.cpp opens. The name said otherwise, and the two were
   * landing in the same place anyway.
   */
  it('is named for the catalogue it holds, not for one of its models', () => {
    expect(defaultModelFolder('/user/data')).toBe(join('/user/data', 'models'))
  })

  /**
   * A model already downloaded is 640 MB. Carrying it up rather than letting the next install
   * fetch it again is the whole point — file by file, because the destination already exists.
   */
  it('carries what an earlier version wrote one level down', async () => {
    const root = folderWith({ 'encoder.int8.onnx': 'weights', 'tokens.txt': 'a b c' })

    await migrateSttFolder(root)

    expect(readFileSync(join(root, 'encoder.int8.onnx'), 'utf8')).toBe('weights')
    expect(readFileSync(join(root, 'tokens.txt'), 'utf8')).toBe('a b c')
    expect(existsSync(join(root, 'stt'))).toBe(false)
  })

  // It runs on every launch, for the life of the release that renamed the folder. A machine that
  // never held the old one must not be the one it fails on.
  it('does nothing at all where there is nothing to carry', async () => {
    const root = mkdtempSync(join(tmpdir(), 'models-'))

    await expect(migrateSttFolder(root)).resolves.toBeUndefined()
    await expect(migrateSttFolder(join(root, 'never-created'))).resolves.toBeUndefined()
  })

  /**
   * 🛑 What it cannot move is LEFT where it is: the cost is one re-download of a model still on
   * the disk, never a deletion. A name already taken above is exactly that case.
   */
  it('leaves behind what it cannot move rather than losing it', async () => {
    const root = folderWith({ 'tokens.txt': 'the old one' })
    writeFileSync(join(root, 'tokens.txt'), 'the new one')

    await migrateSttFolder(root)

    expect(readFileSync(join(root, 'tokens.txt'), 'utf8')).toBe('the new one')
  })
})
