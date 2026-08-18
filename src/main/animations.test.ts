import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { bundledAnimationList } from './animations'

let root = ''

async function animation(name: string, files: readonly string[]): Promise<void> {
  await mkdir(join(root, name), { recursive: true })
  for (const file of files) await writeFile(join(root, name, file), '')
}

describe('the animations shipped beside the app', () => {
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'animations-'))
  })

  it('names each one after its folder, never after what the clip inside spells', async () => {
    await animation('walk', ['animation.glb'])

    const found = await bundledAnimationList(root)
    expect(found.map(one => one.name)).toEqual(['walk'])
    expect(found[0]?.path).toBe(join(root, 'walk', 'animation.glb'))
  })

  it('carries the thumbnail when the folder holds one, and nothing when it does not', async () => {
    await animation('walk', ['animation.glb', 'thumb.png'])
    await animation('run', ['run.fbx'])

    const found = await bundledAnimationList(root)
    expect(found.find(one => one.name === 'walk')?.thumbnail).toBe(join(root, 'walk', 'thumb.png'))
    expect(found.find(one => one.name === 'run')?.thumbnail).toBeNull()
  })

  it('takes the three formats the studio reads, and skips a folder holding none', async () => {
    await animation('a', ['clip.glb'])
    await animation('b', ['clip.gltf'])
    await animation('c', ['clip.fbx'])
    await animation('d', ['notes.txt'])

    expect((await bundledAnimationList(root)).map(one => one.name)).toEqual(['a', 'b', 'c'])
  })

  // The app ships without animations until someone installs them: a state to show, never a fault
  // to report.
  it('answers nothing at all when the folder is not there', async () => {
    expect(await bundledAnimationList(join(root, 'nowhere'))).toEqual([])
  })
})
