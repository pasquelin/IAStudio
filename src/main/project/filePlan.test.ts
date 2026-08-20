import { describe, expect, it } from 'vitest'
import { changeOf, foldersFor, freeName, inverseOf, planFiles, type FileRequest } from './filePlan'

/** What the folders concerned hold, written as a test says it — no disk, no project. */
const folders = (held: Record<string, readonly string[]>): Map<string, readonly string[]> =>
  new Map(Object.entries(held))

const plan = (request: FileRequest, held: Record<string, readonly string[]>) =>
  planFiles(request, folders(held))

describe('planning a batch of file gestures', () => {
  /**
   * The whole point of the shape: a batch is a partial result, and a refusal is data. Three
   * hundred rushes into a folder where two names are taken is two hundred and ninety-eight
   * moves, not an exception that undoes the lot.
   */
  it('carries on past a member it refuses, and says which one', () => {
    const { acts, refused } = plan(
      { op: 'move', paths: ['a.png', 'b.png', 'c.png'], folder: 'refs' },
      { '': ['a.png', 'b.png', 'c.png'], refs: ['b.png'] },
    )

    expect(acts).toEqual([
      { act: 'move', from: 'a.png', to: 'refs/a.png' },
      { act: 'move', from: 'c.png', to: 'refs/c.png' },
    ])
    expect(refused).toEqual([{ path: 'b.png', reason: 'exists' }])
  })

  // Two files of the same name from two folders would otherwise both be planned onto it, and the
  // second write would take the first without a word.
  it('counts a name a member of the same batch has just claimed', () => {
    const { acts, refused } = plan(
      { op: 'move', paths: ['one/x.png', 'two/x.png'], folder: 'refs' },
      { one: ['x.png'], two: ['x.png'], refs: [] },
    )

    expect(acts).toEqual([{ act: 'move', from: 'one/x.png', to: 'refs/x.png' }])
    expect(refused).toEqual([{ path: 'two/x.png', reason: 'exists' }])
  })

  it('refuses a folder dropped inside itself, and inside what it holds', () => {
    const held = { '': ['notes'], notes: ['drafts'], 'notes/drafts': [] }

    expect(plan({ op: 'move', paths: ['notes'], folder: 'notes' }, held).refused).toEqual([
      { path: 'notes', reason: 'into-itself' },
    ])
    expect(plan({ op: 'move', paths: ['notes'], folder: 'notes/drafts' }, held).refused).toEqual([
      { path: 'notes', reason: 'into-itself' },
    ])
  })

  // Not a refusal, and not a write either: dropping a row on the folder it already sits in is
  // the commonest slip of the whole gesture, and it has nothing to say about itself.
  it('does nothing at all when a file is sent where it already is', () => {
    expect(
      plan({ op: 'move', paths: ['notes/a.png'], folder: 'notes' }, { notes: ['a.png'] }),
    ).toEqual({ acts: [], refused: [] })
  })

  /**
   * The root receives, and that is what lets a file come back OUT of a folder — there being no
   * row standing for it to aim at. It is not one of the studio's own paths, so nothing about it
   * needs an exception here.
   */
  it('takes the project folder itself as a destination', () => {
    const { acts } = plan(
      { op: 'move', paths: ['notes/a.png'], folder: '' },
      { notes: ['a.png'], '': ['notes'] },
    )

    expect(acts).toEqual([{ act: 'move', from: 'notes/a.png', to: 'a.png' }])
  })

  /**
   * What the phase opens, and what every other file of it exists to make safe: an asset and a
   * document leave the folders they were filed under. Their role is read off the extension and
   * the catalogue row, and the row follows the file — the folder never said what either was.
   */
  it.each(['assets/img/dusk.png', 'documents/a3f1.gltf', 'assets'])(
    'lets %s leave the folder the studio used to hold',
    path => {
      const held = {
        '': ['assets', 'documents', 'refs'],
        'assets/img': ['dusk.png'],
        documents: ['a3f1.gltf'],
        refs: [],
      }
      const { acts, refused } = plan({ op: 'move', paths: [path], folder: 'refs' }, held)

      expect(acts).toEqual([{ act: 'move', from: path, to: `refs/${path.split('/').pop()}` }])
      expect(refused).toEqual([])
    },
  )

  it('refuses every member when the destination is one of them', () => {
    const { acts, refused } = plan(
      { op: 'move', paths: ['a.png', 'b.png'], folder: '.index' },
      { '': ['a.png', 'b.png'], '.index': [] },
    )

    expect(acts).toEqual([])
    expect(refused).toEqual([
      { path: 'a.png', reason: 'private' },
      { path: 'b.png', reason: 'private' },
    ])
  })

  // How a destination that has gone — or that turned out to be a file — is told from an empty
  // one: `FolderReader.names` answers nothing for either, so neither is in the snapshot.
  it('refuses a destination the folders do not hold', () => {
    const { refused } = plan({ op: 'move', paths: ['a.png'], folder: 'gone' }, { '': ['a.png'] })

    expect(refused).toEqual([{ path: 'a.png', reason: 'missing' }])
  })

  it('refuses a source nothing stands at', () => {
    const { refused } = plan(
      { op: 'move', paths: ['gone.png'], folder: 'refs' },
      { '': [], refs: [] },
    )

    expect(refused).toEqual([{ path: 'gone.png', reason: 'missing' }])
  })
})

describe('duplicating', () => {
  // Suffixed rather than refused: a copy laid beside a file that is by definition already there
  // has nobody to hand a refusal back to.
  it('lays a copy beside the original under the first free name', () => {
    const { acts } = plan(
      { op: 'duplicate', paths: ['Ruelle bleue.png'], folder: null },
      { '': ['Ruelle bleue.png', 'Ruelle bleue 2.png'] },
    )

    expect(acts).toEqual([{ act: 'copy', from: 'Ruelle bleue.png', to: 'Ruelle bleue 3.png' }])
  })

  // Which is what a paste of something COPIED is: the same act, into a folder that was named.
  it('copies into another folder, keeping the name where it is free', () => {
    const { acts } = plan(
      { op: 'duplicate', paths: ['a.png'], folder: 'refs' },
      { '': ['a.png'], refs: [] },
    )

    expect(acts).toEqual([{ act: 'copy', from: 'a.png', to: 'refs/a.png' }])
  })
})

describe('creating a folder', () => {
  it('refuses a name the folder already holds', () => {
    expect(
      plan({ op: 'createFolder', folder: '', name: 'Characters' }, { '': ['Characters'] }),
    ).toEqual({ acts: [], refused: [{ path: 'Characters', reason: 'exists' }] })
  })

  it('makes one at the root, which is where a project is organised from', () => {
    const { acts } = plan({ op: 'createFolder', folder: '', name: 'Characters' }, { '': [] })

    expect(acts).toEqual([{ act: 'createFolder', to: 'Characters' }])
  })
})

describe('renaming', () => {
  it('stays in the folder the file already sits in', () => {
    const { acts } = plan(
      { op: 'rename', path: 'notes/brief.pdf', name: 'note.pdf' },
      { notes: ['brief.pdf'] },
    )

    expect(acts).toEqual([{ act: 'move', from: 'notes/brief.pdf', to: 'notes/note.pdf' }])
  })

  // One file changing how it is spelled, not a collision with another — and asking the disk
  // would refuse the rename against the very file being renamed.
  it('lets a name change case, which is the same file', () => {
    const { acts, refused } = plan(
      { op: 'rename', path: 'Ruelle.png', name: 'ruelle.png' },
      { '': ['Ruelle.png'] },
    )

    expect(acts).toEqual([{ act: 'move', from: 'Ruelle.png', to: 'ruelle.png' }])
    expect(refused).toEqual([])
  })
})

describe('trashing', () => {
  /**
   * The one thing `'shown'` still tells apart, now that the studio holds no ordinary folder: the
   * project folder RECEIVES — it is a destination like any other — but throwing it away would
   * throw away the project, and nothing on screen is meant to be able to ask for that.
   */
  it('refuses the project folder itself, which receives but does not go', () => {
    const held = { '': ['refs'], refs: [] }

    expect(plan({ op: 'trash', paths: [''] }, held).refused).toEqual([
      { path: '', reason: 'private' },
    ])
    expect(
      plan({ op: 'move', paths: ['refs/a.png'], folder: '' }, { ...held, refs: ['a.png'] }).acts,
    ).toEqual([{ act: 'move', from: 'refs/a.png', to: 'a.png' }])
  })
})

/**
 * The explorer offers to SHOW them, which is what makes this reachable: a row on screen is a row
 * a menu can be raised on. `.index/` is a catalogue rebuilt from the folder and `.project.json`
 * is what makes the folder a project — renaming either from the tree breaks the project for the
 * sake of a name nobody reads.
 */
describe('what the studio keeps under a dot', () => {
  const held = { '': ['.project.json', '.index', 'refs'], '.index': ['catalog.db'], refs: [] }

  it('refuses every gesture that would write to it', () => {
    expect(plan({ op: 'rename', path: '.project.json', name: 'p.json' }, held).refused).toEqual([
      { path: '.project.json', reason: 'private' },
    ])
    expect(plan({ op: 'trash', paths: ['.index/catalog.db'] }, held).refused).toEqual([
      { path: '.index/catalog.db', reason: 'private' },
    ])
    expect(plan({ op: 'move', paths: ['.project.json'], folder: 'refs' }, held).refused).toEqual([
      { path: '.project.json', reason: 'private' },
    ])
  })

  it('refuses it as a destination as well', () => {
    expect(plan({ op: 'move', paths: ['refs'], folder: '.index' }, held).refused).toEqual([
      { path: 'refs', reason: 'private' },
    ])
    expect(plan({ op: 'createFolder', folder: '.index', name: 'x' }, held).refused).toEqual([
      { path: '.index', reason: 'private' },
    ])
  })
})

describe('reading a batch back', () => {
  /**
   * The shape undo is built on, and the reason the trash cannot be taken back: a change with
   * nothing at `to` has no inverse to build, `shell.trashItem` offering no portable way back.
   */
  it('inverts a move, undoes a creation by trashing it, and gives up on a trash', () => {
    expect(inverseOf({ from: 'a.png', to: 'refs/a.png' })).toEqual({
      act: 'move',
      from: 'refs/a.png',
      to: 'a.png',
    })
    expect(inverseOf({ from: '', to: 'Characters' })).toEqual({
      act: 'trash',
      from: 'Characters',
    })
    expect(inverseOf({ from: 'a.png', to: '' })).toBeNull()
  })

  // A copy is a file that CAME, whatever it was copied from: the catalogue has no row for it,
  // and undoing it means taking it away rather than putting the original back.
  it('reads a copy as a file that arrived, and a trash as one that went', () => {
    expect(changeOf({ act: 'copy', from: 'a.png', to: 'a 2.png' })).toEqual({
      from: '',
      to: 'a 2.png',
    })
    expect(changeOf({ act: 'trash', from: 'a.png' })).toEqual({ from: 'a.png', to: '' })
  })
})

describe('the folders a request has to be planned against', () => {
  it('names the destination as well as every source folder', () => {
    expect(foldersFor({ op: 'move', paths: ['one/a.png', 'b.png'], folder: 'refs' })).toEqual([
      'one',
      '',
      'refs',
    ])
  })
})

describe('finding a free name', () => {
  /**
   * The bound, and it is the reason this is worth a case of its own: `safeFileName` cuts at the
   * length limit, so a stem already that long would come back as itself from every candidate —
   * every one would read as taken, and the loop would never end, in the process that owns every
   * window.
   */
  it('keeps room for the suffix on a name already at the limit', () => {
    const long = `${'a'.repeat(80)}.png`
    const free = freeName(new Set([long.toLowerCase()]), long)

    expect(free).not.toBe(long)
    expect(free.endsWith(' 2.png')).toBe(true)
  })

  // APFS and NTFS hold one file for two spellings of a name, so a raw comparison would call the
  // second one free and hand it to a write that overwrites.
  it('reads a name taken in another case as taken', () => {
    expect(freeName(new Set(['ruelle.png']), 'Ruelle.png')).toBe('Ruelle 2.png')
  })
})
