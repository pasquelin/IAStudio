import { describe, expect, it } from 'vitest'
import {
  DOCUMENT_KINDS,
  DOCUMENT_MANIFEST,
  documentPath,
  FOLDER_KINDS,
  isPartName,
  EXTENSIONS_BY_KIND,
  isDocumentKind,
  kindForExtension,
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
  it('reads back the extension every kind is held under', () => {
    for (const kind of DOCUMENT_KINDS) {
      expect(kindForExtension(EXTENSIONS_BY_KIND[kind])).toBe(kind)
    }
  })

  // A montage IS its OpenTimelineIO file: the studio's own spelling is not written any more, and
  // it is not READ any more either — a `.seq` left in a folder is not a document of this build.
  it('holds a montage in the open format, and in nothing else', () => {
    expect(EXTENSIONS_BY_KIND.sequence).toBe('.otio')
    expect(kindForExtension('.otio')).toBe('sequence')
    expect(kindForExtension('.seq')).toBeNull()
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
    expect(documentPath('a3f1', 'scene')).toBe('documents/a3f1.scene')
    expect(documentPath('a3f1', 'image')).toBe('documents/a3f1.img')
    expect(documentPath('a3f1', 'sequence')).toBe('documents/a3f1.otio')
  })

  it('gives every kind an extension of its own', () => {
    const paths = DOCUMENT_KINDS.map(kind => documentPath('id', kind))
    expect(new Set(paths).size).toBe(DOCUMENT_KINDS.length)
  })

  // The compiler keeps `EXTENSIONS_BY_KIND` complete; nothing keeps `DOCUMENT_KINDS` complete,
  // and a kind missing from it is refused at the IPC boundary without a word.
  it('lists every kind the extension table knows', () => {
    expect([...DOCUMENT_KINDS].sort()).toEqual(Object.keys(EXTENSIONS_BY_KIND).sort())
  })

  // Two kinds sharing a spelling would send one to the other's editor, and `kindForExtension`
  // answers whichever came first in the list without a word.
  it('gives no extension to two kinds', () => {
    const spellings = DOCUMENT_KINDS.map(kind => EXTENSIONS_BY_KIND[kind])
    expect(new Set(spellings).size).toBe(spellings.length)
  })
})

/**
 * The one field of the document contract that crosses a security boundary: the renderer names
 * these, and the main process turns the name into a path.
 */
describe('isPartName', () => {
  it('accepts the name a layer’s picture is written under', () => {
    expect(isPartName('a1b2c3.png')).toBe(true)
    expect(isPartName('layer_1-mask.png')).toBe(true)
  })

  it('refuses anything that could climb out of the folder', () => {
    expect(isPartName('../secrets.png')).toBe(false)
    expect(isPartName('..')).toBe(false)
    expect(isPartName('/etc/passwd')).toBe(false)
    expect(isPartName('sub/dir.png')).toBe(false)
    expect(isPartName('a\\b.png')).toBe(false)
  })

  it('refuses a name that is not a plain file name', () => {
    expect(isPartName('')).toBe(false)
    expect(isPartName('nodot')).toBe(false)
    expect(isPartName('.png')).toBe(false)
    expect(isPartName('a b.png')).toBe(false)
  })

  // A part standing where the manifest goes would overwrite the document with a picture.
  it('refuses the manifest’s own name', () => {
    expect(isPartName(DOCUMENT_MANIFEST)).toBe(false)
  })
})

describe('FOLDER_KINDS', () => {
  // The image is the only kind whose pixels cannot fit in the content string.
  it('names the image, and only the image', () => {
    expect([...FOLDER_KINDS]).toEqual(['image'])
  })
})
