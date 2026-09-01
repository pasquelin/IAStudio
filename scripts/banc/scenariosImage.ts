import type { Scenario } from './run'
import * as read from './oracle'
import { boatImage, layerAt, overlay } from './setups'

/** Sections 18 and 19: editing a picture, and its layer stack. */

export const IMAGE_SCENARIOS: readonly Scenario[] = [
  // ——— 18. Édition d'image ———
  {
    name: '18.1 duplicates the picture before touching it',
    said: ['Duplique cette image avant de la modifier.'],
    setup: boatImage,
    passed: run => read.files(run).filter(one => one.includes('bateau')).length >= 2,
  },
  {
    name: '18.2 renames the copy bateau-edition-test',
    said: ['Renomme la copie bateau-edition-test.'],
    setup: async studio => {
      await boatImage(studio)
      await studio.run('files.duplicate', { paths: ['Images/fais moi un bateau.png'] })
    },
    passed: run => read.files(run).some(one => one.includes('bateau-edition-test')),
  },
  {
    name: '18.3 lowers its opacity to 70 percent',
    said: ['Réduis son opacité à 70 %.'],
    setup: boatImage,
    passed: run => read.layers(run).some(one => read.near(one.opacity, 0.7, 0.01)),
  },
  {
    name: '18.4 moves it 100 pixels to the right',
    said: ['Déplace-la de 100 pixels vers la droite.'],
    setup: boatImage,
    passed: run => read.layers(run).some(one => read.near(one.transform.x, 100, 0.01)),
  },
  {
    name: '18.5 grows it by 20 percent',
    said: ['Augmente sa taille de 20 %.'],
    setup: boatImage,
    passed: run => read.layers(run).some(one => read.near(one.transform.scaleX, 1.2, 0.01)),
  },
  {
    name: '18.6 turns it 15 degrees',
    said: ['Fais-la pivoter de 15 degrés.'],
    setup: boatImage,
    // The state holds RADIANS, though `layer.transform` takes the degrees a person types.
    passed: run =>
      read.layers(run).some(one => read.near(one.transform.rotation, read.radians(15), 0.01)),
  },
  {
    name: '18.7 resets the rotation alone',
    said: ['Remets uniquement la rotation à zéro.'],
    setup: async studio => {
      await boatImage(studio)
      const layer = layerAt(studio, 0)
      await studio.run('layer.transform', { layerId: layer, rotation: 15, x: 100, scaleX: 1.2 })
    },
    // The rotation goes back and NOTHING else does — that is the whole word « uniquement ».
    passed: run => {
      const layer = read.layers(run)[0]
      return (
        layer !== undefined &&
        read.near(layer.transform.rotation, 0, 0.01) &&
        read.near(layer.transform.x, 100, 0.01) &&
        read.near(layer.transform.scaleX, 1.2, 0.01)
      )
    },
  },

  // ——— 19. Calques image ———
  {
    name: '19.1 adds a second picture as a layer above the boat',
    said: ['Ajoute une deuxième image comme nouveau calque au-dessus du bateau.'],
    setup: boatImage,
    passed: run => read.layers(run).length === 2,
  },
  {
    name: '19.2 renames that layer Overlay Test',
    said: ['Renomme ce calque Overlay Test.'],
    setup: async studio => {
      await boatImage(studio)
      await studio.run('layer.add', { name: 'Calque 2', kind: 'pixel' })
    },
    passed: run => read.layerNamed(run, 'Overlay Test') !== undefined,
  },
  {
    name: '19.3 puts Overlay Test at 50 percent opacity',
    said: ['Mets Overlay Test à 50 % d’opacité.'],
    setup: overlay,
    passed: run => read.near(read.layerNamed(run, 'Overlay Test')?.opacity ?? 0, 0.5, 0.01),
  },
  {
    name: '19.4 puts Overlay Test behind the boat',
    said: ['Passe Overlay Test derrière le bateau.'],
    setup: overlay,
    // Behind means BELOW, and index 0 is the bottom of the stack.
    passed: run => read.layers(run)[0]?.name.includes('Overlay Test') === true,
  },
  {
    name: '19.5 hides Overlay Test',
    said: ['Masque Overlay Test.'],
    setup: overlay,
    passed: run => read.layerNamed(run, 'Overlay Test')?.visible === false,
  },
  {
    name: '19.6 shows Overlay Test again',
    said: ['Réaffiche Overlay Test.'],
    // Index 1 and not 0: the overlay went on TOP of the boat, and hiding the boat measures
    // nothing about showing the overlay.
    setup: async studio => {
      await overlay(studio)
      await studio.run('layer.setOpacityBlendAndVisibility', {
        layerId: layerAt(studio, 1),
        visible: false,
      })
    },
    passed: run => read.layerNamed(run, 'Overlay Test')?.visible === true,
  },
  {
    name: '19.7 removes Overlay Test alone',
    said: ['Supprime uniquement Overlay Test.'],
    setup: overlay,
    passed: run =>
      read.layerNamed(run, 'Overlay Test') === undefined && read.layers(run).length === 1,
  },
]
