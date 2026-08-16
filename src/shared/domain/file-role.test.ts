import { describe, expect, it } from 'vitest'
import { EXTENSION_BY_KIND } from './document'
import { FILE_DOMAINS, natureOf } from './file-role'

describe('natureOf', () => {
  it('reads a source file from its extension, whatever folder it sits in', () => {
    expect(natureOf('Characters/hero.png')).toEqual({ domain: 'image', role: 'source' })
    expect(natureOf('A001.mov')).toEqual({ domain: 'video', role: 'source' })
    expect(natureOf('take.wav')).toEqual({ domain: 'audio', role: 'source' })
    expect(natureOf('prop.glb')).toEqual({ domain: 'mesh', role: 'source' })
  })

  /**
   * The decision the whole table rests on. There is no such thing as a texture file: there are
   * PNGs, and a `.tex` document that gives some of them a part to play. A folder called
   * `Textures/` says nothing, and neither does a `_normal` suffix — a normal map and an albedo
   * are both PNGs, and guessing would be right often and wrong silently.
   */
  it('calls a picture a picture, wherever it is and whatever it is called', () => {
    expect(natureOf('Textures/brick_normal.png').domain).toBe('image')
    expect(natureOf('Skies/sunset.hdr').domain).toBe('image')
    expect(natureOf('Materials/albedo.exr').domain).toBe('image')
  })

  it('files a document as an edit, in the domain its editor works in', () => {
    expect(natureOf('Level.scene')).toEqual({ domain: 'mesh', role: 'edit' })
    expect(natureOf('Cover.img')).toEqual({ domain: 'image', role: 'edit' })
    expect(natureOf('Montage.seq')).toEqual({ domain: 'video', role: 'edit' })
    expect(natureOf('Brick.tex')).toEqual({ domain: 'texture', role: 'edit' })
    expect(natureOf('Dusk.sky')).toEqual({ domain: 'skybox', role: 'edit' })
  })

  // A project folder is the user's own: a `.pdf` of notes beside the rushes is shown and left
  // alone. Inventing a domain for it would be worse than saying there is none.
  it('says `other` for a file the studio has no domain for', () => {
    expect(natureOf('notes.pdf')).toEqual({ domain: 'other', role: 'source' })
    expect(natureOf('README')).toEqual({ domain: 'other', role: 'source' })
  })

  it('does not care about the case of the extension', () => {
    expect(natureOf('HERO.PNG').domain).toBe('image')
    expect(natureOf('Level.SCENE').role).toBe('edit')
  })

  // The compiler cannot see this one: `EXTENSION_BY_KIND` is complete by its type, but nothing
  // makes `natureOf` agree with it, and a kind that fell through would be filed as `other`.
  it('knows every document extension the studio writes', () => {
    for (const extension of Object.values(EXTENSION_BY_KIND)) {
      expect(natureOf(`Untitled${extension}`).role).toBe('edit')
    }
  })

  it('offers every domain a file can be filed under', () => {
    expect(FILE_DOMAINS).toContain('other')
    expect(FILE_DOMAINS).toContain('texture')
    expect(new Set(FILE_DOMAINS).size).toBe(FILE_DOMAINS.length)
  })
})
