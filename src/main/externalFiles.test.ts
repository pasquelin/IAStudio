import { describe, expect, it } from 'vitest'
import {
  authoriseExternalFiles,
  claimExternalFiles,
  externalPathsFromArguments,
} from './externalFiles'

describe('externalPathsFromArguments', () => {
  it('keeps absolute file arguments so a desktop launch can report accepted and refused files', () => {
    expect(
      externalPathsFromArguments([
        '/Applications/IA Studio',
        '/work/model.glb',
        '/work/image.png',
        '--inspect',
        'relative.glb',
      ]),
    ).toEqual(['/Applications/IA Studio', '/work/model.glb', '/work/image.png'])
  })

  it('keeps unsupported absolute arguments for a visible refusal', () => {
    expect(externalPathsFromArguments(['/work/scene.gltf', '/work/notes.txt'])).toEqual([
      '/work/scene.gltf',
      '/work/notes.txt',
    ])
  })

  it('excludes the executable and application folder from launch candidates', () => {
    expect(
      externalPathsFromArguments(
        ['/Applications/IA Studio', '/work/model.obj'],
        new Set(['/Applications/IA Studio']),
      ),
    ).toEqual(['/work/model.obj'])
  })
})

describe('external file authorisations', () => {
  it('exchanges accepted paths through a one-use opaque request', () => {
    const offer = authoriseExternalFiles(['/work/model.obj', '/work/notes.txt'])

    expect(offer.refused).toEqual([{ name: 'notes.txt', extension: 'txt' }])
    expect(offer.request).not.toBeNull()
    if (!offer.request) return
    expect(claimExternalFiles(offer.request.id)).toEqual(['/work/model.obj'])
    expect(claimExternalFiles(offer.request.id)).toEqual([])
  })

  it('does not authorise an unsupported path and preserves its refusal', () => {
    expect(authoriseExternalFiles(['/work/notes.txt'])).toEqual({
      request: null,
      refused: [{ name: 'notes.txt', extension: 'txt' }],
    })
  })
})
