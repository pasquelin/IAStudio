import { describe, expect, it } from 'vitest'
import { mediaLinkOf, mediaNameOf, mediaPathOf, relinkedBySuffix } from './mediaLink'

describe('the link a montage points at its media with', () => {
  it('climbs out of the montage’s folder and back down to the file', () => {
    expect(mediaLinkOf('rushes/take.mp4', 'Cinematics')).toBe('../rushes/take.mp4')
    expect(mediaLinkOf('Cinematics/take.mp4', 'Cinematics')).toBe('take.mp4')
    expect(mediaLinkOf('rushes/take.mp4', '')).toBe('rushes/take.mp4')
    expect(mediaLinkOf('take.mp4', 'a/b/c')).toBe('../../../take.mp4')
  })

  // A folder called `take.mp4` is not the file `take.mp4`, and stopping one segment short is
  // what keeps a montage sitting beside its own name from pointing at itself.
  it('never eats the file’s own name as a shared folder', () => {
    expect(mediaLinkOf('take.mp4', 'take.mp4')).toBe('../take.mp4')
  })

  it('escapes what a URL cannot carry', () => {
    expect(mediaLinkOf('rushes/prise deux.mp4', '')).toBe('rushes/prise%20deux.mp4')
    expect(mediaLinkOf('a b/c#d.mp4', 'a b')).toBe('c%23d.mp4')
  })
})

describe('the file a link names', () => {
  it('reads a relative link back against the montage’s folder', () => {
    expect(mediaPathOf('../rushes/take.mp4', 'Cinematics')).toBe('rushes/take.mp4')
    expect(mediaPathOf('take.mp4', 'Cinematics')).toBe('Cinematics/take.mp4')
    expect(mediaPathOf('rushes/prise%20deux.mp4', '')).toBe('rushes/prise deux.mp4')
  })

  // An absolute link names the machine it was written on, and where a file sat there says
  // nothing about where it sits here. `relinkedBySuffix` is what answers those.
  it('answers nothing for a link that names somewhere else entirely', () => {
    expect(mediaPathOf('file:///Volumes/Other/take.mp4', '')).toBeNull()
    expect(mediaPathOf('/Volumes/Other/take.mp4', '')).toBeNull()
  })

  it('names the file whatever shape the link takes', () => {
    expect(mediaNameOf('file:///Volumes/Other/prise%20deux.mp4')).toBe('prise deux.mp4')
    expect(mediaNameOf('../rushes/take.mp4')).toBe('take.mp4')
    // A stray per cent is not an escape, and the link still names its file.
    expect(mediaNameOf('rushes/100%.mp4')).toBe('100%.mp4')
  })
})

describe('relinking a montage written on another machine', () => {
  const byPath = new Map([
    ['rushes/take.mp4', 'asset-a'],
    ['b-roll/take.mp4', 'asset-b'],
  ])

  // Longest first: the two folders each hold a `take.mp4`, and the folder is the only thing
  // that tells them apart.
  it('takes the longest tail of the link that names a file here', () => {
    expect(relinkedBySuffix('file:///Volumes/Cut/b-roll/take.mp4', byPath)).toBe('asset-b')
    expect(relinkedBySuffix('file:///Volumes/Cut/rushes/take.mp4', byPath)).toBe('asset-a')
  })

  it('answers nothing rather than guessing on the name alone', () => {
    expect(relinkedBySuffix('file:///Volumes/Cut/other/take.mp4', byPath)).toBeNull()
  })

  it('reads a windows drive letter as a folder, not as a scheme', () => {
    expect(relinkedBySuffix('file:///C:/Cut/rushes/take.mp4', byPath)).toBe('asset-a')
  })
})
