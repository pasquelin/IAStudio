import { assistantAction, type ActionName } from '@shared/domain/assistant'
import type { FakeStudio, StudioFile } from './fakeStudio'

/**
 * The project the bench runs against — a real one, names included.
 *
 * Names in English under folders named in French, because that is the studio's own shape: a
 * picture is named after the prompt that made it, and the person asks for it in their language.
 * A bench built on tidy names would pass on the very thing the studio gets wrong.
 */
export const PROJECT: readonly StudioFile[] = [
  { path: 'Images', kind: 'folder' },
  { path: '3D', kind: 'folder' },
  { path: 'documents', kind: 'folder' },
  { path: 'Textures', kind: 'folder' },
  { path: 'Images/a beautiful sailing ship, sailboat, on the open sea, green.png', kind: 'file' },
  { path: 'Images/a beautiful sailing ship, sailboat, on the open sea.png', kind: 'file' },
  { path: 'Images/fais moi un chateau.png', kind: 'file' },
  { path: 'Images/fais moi un bateau.png', kind: 'file' },
  { path: 'Images/a bicycle.png', kind: 'file' },
  { path: '3D/a medieval stone castle with towers.glb', kind: 'file' },
  { path: 'documents/Charge 2000 blocs.gltf', kind: 'file' },
  { path: 'documents/Scène 1.gltf', kind: 'file' },
  { path: 'documents/demo image.ora', kind: 'file' },
]

/** What a run of one scenario produced, as the oracle reads it. */
export type Run = {
  studio: FakeStudio
  called: readonly { action: ActionName; input: Record<string, unknown> }[]
  refused: number
  said: string
}

export type Scenario = {
  name: string
  said: string
  /**
   * Whether the request was carried out — read off what the studio HOLDS, never off the words
   * the model wrote. Every failure this bench exists for was announced as a success.
   */
  passed: (run: Run) => boolean
}

const opened = (run: Run, ending: string): boolean =>
  run.studio.documents().some(one => one.title.endsWith(ending))

export const SCENARIOS: readonly Scenario[] = [
  {
    /** It answered « no such file » over a folder it could have read, three times over. */
    name: 'opens a picture named in another language',
    said: 'ouvre le fichier du voilier vert',
    passed: run => opened(run, 'green.png'),
  },
  {
    /** Answered from the round before without searching at all. */
    name: 'opens a document whose name it was given almost exactly',
    said: 'ouvre la charge 2000',
    passed: run => opened(run, 'Charge 2000 blocs.gltf'),
  },
  {
    /** Two pictures match: choosing one silently is the failure, asking is the pass. */
    name: 'asks which one when two files match',
    said: 'ouvre le fichier du voilier',
    passed: run => run.studio.documents().length === 0 && /\?/.test(run.said) && run.refused === 0,
  },
  {
    /**
     * The one that left two empty 3D documents behind: opening the picture put the Image space
     * in front, and every scene call after it was refused.
     */
    name: 'puts a picture on a plane in a new 3D document',
    said: "mets moi l'image du chateau sur un plan dans un nouveau fichier 3D",
    passed: run => {
      const scenes = run.studio.documents().filter(one => one.space === '3d')
      // Read off what the scene HOLDS: a plane that carries the picture. One scene, not two —
      // repairing a wrong surface by opening a workspace again is what makes the second.
      const carried = scenes.some(one => one.nodes.some(node => node.material !== null))
      return scenes.length === 1 && carried
    },
  },
  {
    /**
     * Nothing to do but answer. Read off the CALLS, not off the documents: deleting a file makes
     * no document either, and the oracle that counted documents called that a pass.
     */
    name: 'answers a question without touching the studio',
    said: 'quels documents sont ouverts ?',
    passed: run => run.called.every(one => assistantAction(one.action)?.commitment === 'none'),
  },
]
