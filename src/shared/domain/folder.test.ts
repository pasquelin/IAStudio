import { describe, expect, it } from 'vitest'
import {
  canMoveInto,
  entriesByName,
  folderTrail,
  FOLDER_ROOT,
  isHiddenEntry,
  isUnder,
  parentOf,
  pathIn,
  type FolderEntry,
} from './folder'

const entry = (name: string, kind: 'folder' | 'file'): FolderEntry => ({ path: name, name, kind })

describe('what the explorer does not show', () => {
  it.each(['.index', '.project.json', '.DS_Store'])('hides %s', name => {
    expect(isHiddenEntry(name)).toBe(true)
  })

  // Everything else shows, including what the studio cannot open — that is the difference
  // between an explorer and a list of documents.
  it.each(['assets', 'brief.pdf', 'a3f1.gltf'])('shows %s', name => {
    expect(isHiddenEntry(name)).toBe(false)
  })
})

describe('the order a folder reads in', () => {
  it('puts folders before files', () => {
    expect(entriesByName('fr')(entry('zoo', 'folder'), entry('alpha', 'file'))).toBeLessThan(0)
  })

  // A project written in French files `Étude` between `Etat` and `Fond` for a reader, and after
  // `Zoo` for a code unit comparison.
  it('sorts accented names where a reader looks for them', () => {
    const sorted = [entry('Zoo', 'file'), entry('Étude', 'file'), entry('Fond', 'file')].sort(
      entriesByName('fr'),
    )

    expect(sorted.map(one => one.name)).toEqual(['Étude', 'Fond', 'Zoo'])
  })

  /**
   * The reason the language is an argument at all. `Ä` files with `A` for the studio's two
   * languages and after `Z` for a Swedish reader — so the locale the OS happens to run in decides
   * an order neither French nor English asked for, which is exactly what the bare call did.
   */
  it('answers in the language it is handed, not in the one the machine runs', () => {
    const names = [entry('Zoo', 'file'), entry('Ärger', 'file')]

    expect([...names].sort(entriesByName('fr')).map(one => one.name)).toEqual(['Ärger', 'Zoo'])
    expect([...names].sort(entriesByName('sv')).map(one => one.name)).toEqual(['Zoo', 'Ärger'])
  })
})

/**
 * The word that matters is STRICTLY. A folder read again replaces what is under it, and a
 * folder counted as being under itself replaces its own row — which emptied the whole tree.
 */
describe('what a folder holds', () => {
  it('holds what is inside it', () => {
    expect(isUnder('assets/img', 'assets')).toBe(true)
    expect(isUnder('assets/img/one.png', 'assets')).toBe(true)
  })

  it('does not hold itself', () => {
    expect(isUnder('assets', 'assets')).toBe(false)
  })

  it('does not hold a folder whose name merely starts the same', () => {
    expect(isUnder('assets-old/one.png', 'assets')).toBe(false)
  })

  it('holds everything, at the root', () => {
    expect(isUnder('assets', '')).toBe(true)
    expect(isUnder('assets/img/one.png', '')).toBe(true)
  })
})

/**
 * One rule, asked by the panel to refuse the gesture on screen and by the main process to
 * refuse it again. What it cannot answer is whether the destination IS a folder: it has paths
 * and nothing else.
 */
describe('what may be dragged where', () => {
  it('moves a file the user owns into a folder the user owns', () => {
    expect(canMoveInto('brief.pdf', 'notes')).toBe(true)
    expect(canMoveInto('notes/brief.pdf', 'refs')).toBe(true)
  })

  it('moves a folder the user owns into another', () => {
    expect(canMoveInto('notes', 'refs')).toBe(true)
  })

  // The machine's own bookkeeping, refused on BOTH sides: as what moves and as what receives.
  it('refuses what the machine keeps for itself', () => {
    expect(canMoveInto('.index', 'notes')).toBe(false)
    expect(canMoveInto('.index/catalog.db', 'notes')).toBe(false)
    expect(canMoveInto('.project.json', 'notes')).toBe(false)
    expect(canMoveInto('brief.pdf', '.index')).toBe(false)
    expect(canMoveInto('brief.pdf', '.index/proxies')).toBe(false)
  })

  /**
   * The whole point of the phase: an asset leaves the folder it was filed under, and a document
   * leaves `documents/`. Their role is read off the extension and the catalogue row, and the row
   * follows the file through `repath` — the folder said nothing about either.
   */
  it('lets an asset and a document leave the folders they were filed under', () => {
    expect(canMoveInto('assets/img/dusk.png', 'notes')).toBe(true)
    expect(canMoveInto('documents/a3f1.gltf', 'notes')).toBe(true)
    expect(canMoveInto('assets/img', 'notes')).toBe(true)
    expect(canMoveInto('brief.pdf', 'Images')).toBe(true)
  })

  // Dropping on the blank below the tree means "to the project folder", and a file that could
  // enter a folder the user made but never leave it was a browser missing one of two gestures.
  it('takes the project root as a destination, which is how a file comes back out', () => {
    expect(canMoveInto('notes/brief.pdf', '')).toBe(true)
  })

  it('refuses a folder dropped on itself', () => {
    expect(canMoveInto('notes', 'notes')).toBe(false)
  })

  // It would take its own destination with it, and the whole subtree would go unreachable.
  it('refuses a folder dropped inside itself, however deep', () => {
    expect(canMoveInto('notes', 'notes/drafts')).toBe(false)
    expect(canMoveInto('notes', 'notes/drafts/old')).toBe(false)
  })

  it('allows a folder whose name merely starts the same', () => {
    expect(canMoveInto('notes', 'notes-old')).toBe(true)
  })
})

describe('the folder an entry sits in', () => {
  it('is the tree parent', () => {
    expect(parentOf('assets/img/one.png')).toBe('assets/img')
  })

  it('is nothing at the root, which is what the tree calls a root node', () => {
    expect(parentOf('assets')).toBeNull()
  })
})

describe('the path an entry has inside a folder', () => {
  it('joins the folder and the name', () => {
    expect(pathIn('Images/Croquis', 'etude.jpg')).toBe('Images/Croquis/etude.jpg')
  })

  // The root is the whole reason this is a function: joining on `/` there would yield `/Notes`,
  // an absolute path every boundary of the studio refuses.
  it('is the name alone at the root', () => {
    expect(pathIn(FOLDER_ROOT, 'Notes')).toBe('Notes')
  })
})

describe('the folders leading to one', () => {
  it('leads from the project folder down to the one being browsed', () => {
    expect(folderTrail('Images/Rendus')).toEqual([FOLDER_ROOT, 'Images', 'Images/Rendus'])
  })

  /**
   * The project folder is a crumb like any other, and the only one shown at the top: a trail that
   * were empty there would leave the grid with no way back once it had gone down a level.
   */
  it('is the project folder alone at the top', () => {
    expect(folderTrail(FOLDER_ROOT)).toEqual([FOLDER_ROOT])
  })
})
