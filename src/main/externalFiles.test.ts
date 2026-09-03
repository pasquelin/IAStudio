import { describe, expect, it } from 'vitest'
import {
  authoriseExternalFiles,
  claimExternalFiles,
  externalPathsFromArguments,
} from './externalFiles'

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

describe('external file authorisations', () => {
  it('exchanges accepted paths through a one-use opaque request', () => {
    const request = authoriseExternalFiles(['/work/model.glb', '/work/notes.txt'])

    expect(request).not.toBeNull()
    if (!request) return
    expect(claimExternalFiles(request.id)).toEqual(['/work/model.glb'])
    expect(claimExternalFiles(request.id)).toEqual([])
  })

  it('does not authorise an unsupported path', () => {
    expect(authoriseExternalFiles(['/work/notes.txt'])).toBeNull()
  })
})
