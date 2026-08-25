import type { Run, Scenario } from './run'
import * as read from './oracle'
import { boatImage, cutMontage, laid, overlay, soundBed, trackAt } from './setups'

/**
 * Sections 39 and 40: what an image document and a montage answer to beyond the stack and the
 * cut — the canvas itself, what is pointed at, the lock, and the rows a montage is built on.
 */

const audioRow = (run: Run) =>
  read
    .documents(run)
    .flatMap(one => one.tracks)
    .find(one => one.kind === 'audio')

export const CANVAS_SCENARIOS: readonly Scenario[] = [
  {
    name: '39.1 gives the size of the document and how many layers it holds',
    said: ['Quelle est la taille de ce document et combien de calques porte-t-il ?'],
    setup: overlay,
    passed: run => read.spoke(run) && read.answeredWith(run, 'canvas.state'),
  },
  {
    name: '39.2 puts the document at 1080 by 1080',
    said: ['Passe ce document en 1080 sur 1080.'],
    setup: boatImage,
    passed: run => {
      const image = read.inSpace(run, 'image')[0]
      // Not cropped: « passe en 1080 sur 1080 » resizes the document, it does not cut it.
      return image?.width === 1080 && image.height === 1080 && !image.cropped
    },
  },
  {
    name: '39.3 selects the Bateau layer',
    said: ['Sélectionne le calque Bateau.'],
    setup: overlay,
    // The KIND too: `target.select` also fills the list, and « sélectionne le calque » is not
    // « pointe quelque chose ».
    passed: run => run.studio.bench().selection.kind === 'layer',
  },
  {
    name: '39.4 duplicates the Bateau layer',
    said: ['Duplique le calque Bateau.'],
    setup: boatImage,
    passed: run => read.layers(run).length === 2,
  },
  {
    name: '39.5 locks the Bateau layer',
    said: ['Verrouille le calque Bateau pour ne plus y toucher.'],
    setup: boatImage,
    passed: run => read.layerNamed(run, 'Bateau')?.locked === true,
  },
  {
    name: '39.6 adds a text layer reading Bonjour',
    said: ['Ajoute un calque de texte qui dit Bonjour.'],
    setup: boatImage,
    passed: run => read.layers(run).some(one => one.text === 'Bonjour'),
  },

  {
    name: '40.1 puts the playhead at 3 seconds',
    said: ['Place la tête de lecture à 3 secondes.'],
    setup: cutMontage,
    passed: run => read.answeredWith(run, 'sequence.seek'),
  },
  {
    name: '40.2 cuts the first shot in two at 3 seconds',
    said: ['Coupe le premier plan en deux à 3 secondes.'],
    setup: cutMontage,
    passed: run => read.clips(run).length === 3,
  },
  {
    name: '40.3 removes the second shot',
    said: ['Supprime le deuxième plan du montage.'],
    setup: cutMontage,
    passed: run => read.clips(run).length === 1,
  },
  {
    name: '40.4 selects the first shot',
    said: ['Sélectionne le premier plan.'],
    setup: cutMontage,
    passed: run => run.studio.bench().selection.kind === 'clip',
  },
  {
    name: '40.5 renames the sound row Ambiance',
    said: ['Renomme la piste audio Ambiance.'],
    setup: soundBed,
    passed: run => audioRow(run)?.name === 'Ambiance',
  },
  {
    name: '40.6 mutes the sound row',
    said: ['Coupe le son de la piste audio.'],
    setup: soundBed,
    passed: run => audioRow(run)?.muted === true,
  },
  {
    name: '40.7 removes the sound row and what it carries',
    said: ["Supprime la piste audio et tout ce qu'elle porte."],
    // Two sounds on it, so the removal shows on the clips as well as on the rows.
    setup: studio => {
      soundBed(studio)
      laid(studio, trackAt(studio, 1), 'waves on a wooden hull.wav', 6 * read.SECOND)
    },
    passed: run => audioRow(run) === undefined && read.clips(run).length === 2,
  },
]
