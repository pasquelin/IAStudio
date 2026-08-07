import { describe, expect, it } from 'vitest'
import {
  DOCUMENT_KINDS,
  documentPath,
  EXTENSION_BY_KIND,
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

  it('has no editable document for the workspaces without an editor yet', () => {
    expect(kindForWorkspace('textures')).toBeNull()
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
  it('reads back the extension every kind is written under', () => {
    for (const kind of DOCUMENT_KINDS) {
      expect(kindForExtension(EXTENSION_BY_KIND[kind])).toBe(kind)
    }
  })

  // A project folder is the user's own: it holds notes, exports, and whatever else was dropped
  // in there. Only what this build wrote is a document.
  it('answers null for anything else in the folder', () => {
    expect(kindForExtension('.txt')).toBeNull()
    expect(kindForExtension('.tmp')).toBeNull()
    expect(kindForExtension('')).toBeNull()
    expect(kindForExtension('.tex')).toBeNull()
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
    expect(isDocumentKind('texture')).toBe(false)
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
    expect(documentPath('a3f1', 'sequence')).toBe('documents/a3f1.seq')
  })

  it('gives every kind an extension of its own', () => {
    const paths = DOCUMENT_KINDS.map(kind => documentPath('id', kind))
    expect(new Set(paths).size).toBe(DOCUMENT_KINDS.length)
  })

  // The compiler keeps `EXTENSION_BY_KIND` complete; nothing keeps `DOCUMENT_KINDS` complete,
  // and a kind missing from it is refused at the IPC boundary without a word.
  it('lists every kind the extension table knows', () => {
    expect([...DOCUMENT_KINDS].sort()).toEqual(Object.keys(EXTENSION_BY_KIND).sort())
  })
})
