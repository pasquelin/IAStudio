import { describe, expect, it } from 'vitest'
import { externalPathsFromArguments } from './externalFiles'

describe('externalPathsFromArguments', () => {
  it('keeps supported absolute file arguments on desktop launches', () => {
    expect(
      externalPathsFromArguments([
        '/Applications/IA Studio',
        '/work/model.glb',
        '/work/image.png',
        '--inspect',
        'relative.glb',
      ]),
    ).toEqual(['/work/model.glb', '/work/image.png'])
  })

  it('leaves unsupported file arguments to the operating system', () => {
    expect(externalPathsFromArguments(['/work/scene.gltf', '/work/notes.txt'])).toEqual([])
  })
})
