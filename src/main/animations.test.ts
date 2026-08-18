import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { bundledAnimationFile, bundledAnimationList } from './animations'

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

    expect((await bundledAnimationList(root)).map(one => one.name)).toEqual(['walk'])
  })

  it('says whether the folder holds a thumbnail, which is all the window needs to ask for it', async () => {
    await animation('walk', ['animation.glb', 'thumb.png'])
    await animation('run', ['run.fbx'])

    const found = await bundledAnimationList(root)
    expect(found.find(one => one.name === 'walk')?.thumbnail).toBe(true)
    expect(found.find(one => one.name === 'run')?.thumbnail).toBe(false)
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

describe('the file the animation host hands over', () => {
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'animations-'))
  })

  // A document holds the NAME of an animation and nothing more: which file is inside the folder
  // is the host's business, and the same rule as the list decides it.
  it('answers the clip of a folder named alone', async () => {
    await animation('walk', ['thumb.png', 'animation.glb'])

    expect(await bundledAnimationFile(root, 'walk')).toBe(join(root, 'walk', 'animation.glb'))
  })

  it('answers the very file when the name goes deeper, which is how a thumbnail is asked for', async () => {
    await animation('walk', ['animation.glb', 'thumb.png'])

    expect(await bundledAnimationFile(root, 'walk/thumb.png')).toBe(join(root, 'walk', 'thumb.png'))
  })

  it('answers nothing for a folder holding no clip, and for one that is not there', async () => {
    await animation('empty', ['notes.txt'])

    expect(await bundledAnimationFile(root, 'empty')).toBeNull()
    expect(await bundledAnimationFile(root, 'nowhere')).toBeNull()
  })

  // The name comes from a document, and a document is a file someone can edit: the same refusal
  // the project's own scheme applies, or the scheme serves whatever the path walks out to.
  it('refuses a name walking out of the animations folder', async () => {
    await animation('walk', ['animation.glb'])

    expect(await bundledAnimationFile(root, '../secrets/.env')).toBeNull()
    expect(await bundledAnimationFile(root, join(root, 'walk'))).toBeNull()
  })
})
