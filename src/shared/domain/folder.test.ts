import { describe, expect, it } from 'vitest'
import {
  canMoveInto,
  entriesByName,
  isHiddenEntry,
  isUnder,
  parentOf,
  type FolderEntry,
} from './folder'

const entry = (name: string, kind: 'folder' | 'file'): FolderEntry => ({ path: name, name, kind })

describe('what the explorer does not show', () => {
  it.each(['.index', '.project.json', '.DS_Store'])('hides %s', name => {
    expect(isHiddenEntry(name)).toBe(true)
  })

  // Everything else shows, including what the studio cannot open — that is the difference
  // between an explorer and a list of documents.
  it.each(['assets', 'brief.pdf', 'a3f1.scene'])('shows %s', name => {
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

  // The catalogue stores every asset by a path under `assets/`: moving one orphans rows nobody
  // can find again, and a file landing there is a file no row knows about.
  it('refuses a studio folder as what moves', () => {
    expect(canMoveInto('assets', 'notes')).toBe(false)
    expect(canMoveInto('assets/img', 'notes')).toBe(false)
    expect(canMoveInto('documents', 'notes')).toBe(false)
  })

  it('refuses a studio folder as what receives, which is the half a drag adds', () => {
    expect(canMoveInto('brief.pdf', 'assets')).toBe(false)
    expect(canMoveInto('brief.pdf', 'assets/img')).toBe(false)
    expect(canMoveInto('brief.pdf', 'documents')).toBe(false)
  })

  // No row stands for the root, so no drop can name it — the day one does, this expectation is
  // the decision to revisit rather than a rule to keep.
  it('refuses the project root, which no row names today', () => {
    expect(canMoveInto('notes/brief.pdf', '')).toBe(false)
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
