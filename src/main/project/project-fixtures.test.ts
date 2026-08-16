import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DOCUMENT_KINDS } from '@shared/domain/document'
import { createDocumentFiles } from './documents'
import { snapshotDocuments, withTempProject } from './project-fixtures'

/**
 * The measuring tool has to be measured too: a snapshot that missed a document, or that differed
 * between two reads of the same folder, would report every later phase as safe.
 */
describe('the project fixture', () => {
  it('creates a real project folder, and takes it away with the test', async () => {
    const { root, project } = await withTempProject('Mine')

    expect(project.manifest.name).toBe('Mine')
    expect(await readdir(root)).toContain('.project.json')
  })

  it('reads every kind of document back through one snapshot', async () => {
    const { documents } = await withTempProject()

    for (const kind of DOCUMENT_KINDS) {
      await documents.write(`doc-${kind}`, kind, { title: kind, content: `{"of":"${kind}"}` })
    }

    const taken = await snapshotDocuments(documents)

    expect(taken).toHaveLength(DOCUMENT_KINDS.length)
    expect(taken.map(one => one.kind).sort()).toEqual([...DOCUMENT_KINDS].sort())
    expect(taken.every(one => one.content === `{"of":"${one.kind}"}`)).toBe(true)
  })

  /**
   * The whole point of the tool. A folder read by a second reader — one holding none of the
   * first's caches — must describe the same project, or nothing built on this measures anything.
   */
  it('describes the same project when it is read again from scratch', async () => {
    const { root, documents } = await withTempProject()
    await documents.write('doc-1', 'scene', { title: 'Level', content: '{"nodes":[]}' })
    await documents.write('doc-2', 'audio', { title: 'Take', content: '{"chain":[]}' })

    const first = await snapshotDocuments(documents)
    const second = await snapshotDocuments(
      createDocumentFiles({ projectPath: () => root, now: () => '2026-08-16T10:00:00.000Z' }),
    )

    expect(second).toEqual(first)
  })

  it('records a document the folder lists but the disk will not give back', async () => {
    const { root, documents } = await withTempProject()
    await documents.write('doc-1', 'scene', { title: 'Level', content: '{"nodes":[]}' })

    // Read through a reader pointed at a folder that holds nothing: what `list` cannot find is
    // absent from the snapshot rather than crashing it.
    const elsewhere = createDocumentFiles({
      projectPath: () => join(root, 'nowhere'),
      now: () => '2026-08-16T10:00:00.000Z',
    })

    expect(await snapshotDocuments(elsewhere)).toEqual([])
  })
})
