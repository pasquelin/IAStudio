import { describe, expect, it } from 'vitest'
import {
  DOCUMENT_KINDS,
  documentPath,
  EXTENSIONS_BY_KIND,
  isDocumentKind,
  kindForExtension,
  kindsForExtension,
  kindForWorkspace,
  workspaceForKind,
} from './document'
import { WORKSPACE_IDS } from './workspace'

describe('kindForWorkspace', () => {
  it('gives the image workspace an image document', () => {
    expect(kindForWorkspace('image')).toBe('image')
  })

  it('gives the 3d workspace a scene document', () => {
    expect(kindForWorkspace('3d')).toBe('scene')
  })

  it('gives the video workspace a sequence document', () => {
    expect(kindForWorkspace('video')).toBe('sequence')
  })

  it('gives the audio workspace a take to edit', () => {
    expect(kindForWorkspace('audio')).toBe('audio')
  })

  it('gives the skyboxes workspace a sky to edit', () => {
    expect(kindForWorkspace('skyboxes')).toBe('skybox')
  })

  it('gives the textures workspace a material to edit', () => {
    expect(kindForWorkspace('textures')).toBe('texture')
  })

  // Every workspace opens a document of its own now. The `null` branch stays for the next one
  // to arrive: a workspace whose editor does not exist yet disables the new-document button.
  it('answers with a kind for every workspace the studio shows', () => {
    for (const id of WORKSPACE_IDS) expect(kindForWorkspace(id)).not.toBeNull()
  })

  it('answers for every known workspace', () => {
    for (const id of WORKSPACE_IDS) expect(() => kindForWorkspace(id)).not.toThrow()
  })
})

describe('workspaceForKind', () => {
  it('sends every kind back to the workspace that opens it', () => {
    expect(workspaceForKind('scene')).toBe('3d')
    expect(workspaceForKind('image')).toBe('image')
    expect(workspaceForKind('sequence')).toBe('video')
    expect(workspaceForKind('audio')).toBe('audio')
    expect(workspaceForKind('skybox')).toBe('skyboxes')
  })

  // A document filed under a workspace that does not open it is a tab nothing can render, and
  // listing a project folder builds one descriptor per file from this answer alone.
  it('agrees with kindForWorkspace on every kind', () => {
    for (const kind of DOCUMENT_KINDS) {
      const workspace = workspaceForKind(kind)
      expect(workspace).not.toBeNull()
      if (workspace) expect(kindForWorkspace(workspace)).toBe(kind)
    }
  })
})

describe('kindForExtension', () => {
  // Where two kinds share a spelling this answers the first of them, and the FILE settles it —
  // `documentBody.ts` reads which kind out of what the file itself carries.
  it('answers the first kind of a spelling two of them share', () => {
    expect(kindForExtension('.otio')).toBe('sequence')
    expect(kindForExtension('.gltf')).toBe('scene')
  })

  /**
   * Every kind is held in a format other applications already read. The studio's own spellings
   * are not written any more, and they are not READ any more either: one left in a folder is not
   * a document of this build.
   */
  it('holds every kind in an open format, and reads no spelling of the studio’s own', () => {
    expect([...DOCUMENT_KINDS].map(kind => EXTENSIONS_BY_KIND[kind])).toEqual([
      '.ora',
      '.gltf',
      '.otio',
      '.otio',
      '.gltf',
      '.mtlx',
    ])
    for (const gone of ['.img', '.scene', '.seq', '.aud', '.sky', '.tex']) {
      expect(kindForExtension(gone)).toBeNull()
    }
  })

  // A project folder is the user's own: it holds notes, exports, and whatever else was dropped
  // in there. Only what this build wrote is a document.
  it('answers null for anything else in the folder', () => {
    expect(kindForExtension('.txt')).toBeNull()
    expect(kindForExtension('.tmp')).toBeNull()
    expect(kindForExtension('')).toBeNull()
    expect(kindForExtension('.obj')).toBeNull()
  })

  // `documentPath` writes in lower case: accepted here, a `.SCENE` would be listed under a name
  // `read` cannot find on a case-sensitive volume, and saved beside the original rather than over
  // it.
  it('refuses an extension in capitals rather than listing a file it could not reopen', () => {
    expect(kindForExtension('.SCENE')).toBeNull()
  })
})

describe('isDocumentKind', () => {
  it('accepts every declared kind', () => {
    for (const kind of DOCUMENT_KINDS) expect(isDocumentKind(kind)).toBe(true)
  })

  it('rejects what a hand-edited file could hold', () => {
    expect(isDocumentKind('material')).toBe(false)
    expect(isDocumentKind('')).toBe(false)
    expect(isDocumentKind(null)).toBe(false)
    expect(isDocumentKind(undefined)).toBe(false)
    expect(isDocumentKind(3)).toBe(false)
  })
})

describe('documentPath', () => {
  // Relative, and under the folder the project creates: a project folder can be moved.
  it('names the file after the kind, so a project folder reads by eye', () => {
    expect(documentPath('a3f1', 'scene')).toBe('documents/a3f1.gltf')
    expect(documentPath('a3f1', 'image')).toBe('documents/a3f1.ora')
    expect(documentPath('a3f1', 'sequence')).toBe('documents/a3f1.otio')
  })

  // The compiler keeps `EXTENSIONS_BY_KIND` complete; nothing keeps `DOCUMENT_KINDS` complete,
  // and a kind missing from it is refused at the IPC boundary without a word.
  it('lists every kind the extension table knows', () => {
    expect([...DOCUMENT_KINDS].sort()).toEqual(Object.keys(EXTENSIONS_BY_KIND).sort())
  })

  // What a file's own head is allowed to claim. A pair here is a container serving two editors;
  // a THIRD kind joining one would let a file open in an editor nothing meant it for.
  it('bounds a shared spelling to the two kinds that container serves', () => {
    expect(kindsForExtension('.otio')).toEqual(['sequence', 'audio'])
    expect(kindsForExtension('.gltf')).toEqual(['scene', 'skybox'])
    expect(kindsForExtension('.ora')).toEqual(['image'])
    expect(kindsForExtension('.txt')).toEqual([])
  })
})
