import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { DocumentDescriptor } from '@shared/domain/document'
import { importFiles } from './importFiles'

describe('importFiles nest names', () => {
  it('nests a document named ...gltf inside the project rather than its parent', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ia-studio-import-'))
    const outside = await mkdtemp(join(tmpdir(), 'ia-studio-source-'))
    const source = join(outside, '...gltf')
    await writeFile(
      source,
      JSON.stringify({ asset: { version: '2.0' }, buffers: [{ uri: 'mesh.bin' }] }),
    )
    await writeFile(join(outside, 'mesh.bin'), 'bin')
    const document: DocumentDescriptor = {
      id: 'document-dots',
      kind: 'scene',
      workspace: '3d',
      title: 'Dots',
      path: 'document/...gltf',
    }

    const imported = await importFiles([source], '', {
      projectPath: () => root,
      names: async () => [],
      adopt: async () => null,
      documents: async () => [document],
      importBundle: async () => null,
    })

    expect(await readFile(join(root, 'document', 'mesh.bin'), 'utf8')).toBe('bin')
    expect(imported.documents).toEqual([document])
  })

  it('does not delete the project when a ..gltf import is cancelled', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ia-studio-import-'))
    await writeFile(join(root, 'kept.txt'), 'keep')
    const outside = await mkdtemp(join(tmpdir(), 'ia-studio-source-'))
    const source = join(outside, '..gltf')
    await writeFile(
      source,
      JSON.stringify({ asset: { version: '2.0' }, buffers: [{ uri: 'Heavy.bin' }] }),
    )
    await writeFile(join(outside, 'Heavy.bin'), Buffer.alloc(8 * 1024 * 1024))
    const controller = new AbortController()

    await importFiles(
      [source],
      '',
      {
        projectPath: () => root,
        names: async () => [],
        adopt: async () => null,
        documents: async () => [],
        importBundle: async () => null,
      },
      { signal: controller.signal, onStep: () => controller.abort() },
    )

    expect(await readFile(join(root, 'kept.txt'), 'utf8')).toBe('keep')
  })
})
