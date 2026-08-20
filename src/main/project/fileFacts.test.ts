import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { fileFactsOf } from './fileFacts'

async function tempRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'scenario-file-facts-'))
}

describe('what the disk says about one entry', () => {
  it('measures a file and stamps it', async () => {
    const root = await tempRoot()
    const file = join(root, 'brief.txt')
    await writeFile(file, 'douze octets')

    const facts = await fileFactsOf(file)

    expect(facts?.kind).toBe('file')
    expect(facts?.bytes).toBe(12)
    // Written a moment ago, so the stamp has to parse and to sit in the past.
    expect(Date.parse(facts?.modifiedAt ?? '')).toBeLessThanOrEqual(Date.now())
  })

  it('tells a folder from a file rather than refusing it', async () => {
    const root = await tempRoot()
    await mkdir(join(root, 'Notes'))

    expect((await fileFactsOf(join(root, 'Notes')))?.kind).toBe('folder')
  })

  it('answers nothing for a path that has gone', async () => {
    expect(await fileFactsOf(join(await tempRoot(), 'never-written.png'))).toBeNull()
  })
})
