import type { Studio } from './studio'
import type { Run, Scenario } from './run'
import * as read from './oracle'
import { cutMontage, generated, madeBoat, madeCar, madeChest, named, scene } from './setups'

/**
 * Sections 20 to 23: generating, and generating FROM something of the project. The bench answers
 * a generation synchronously — what is measured is arming, filling and SENDING, never patience.
 */

/** A generated chest already placed in the scene, which 22.5 and 22.6 move and scale. */
const chestIn = async (studio: Studio): Promise<void> => {
  await madeChest(studio)
  const made = studio.assets().at(-1)?.id ?? ''
  await studio.run('node.addModel', { assetId: made, name: 'Coffre' })
}

/** Whether the picture the person pointed at was handed to the generator. */
const usedAsReference = (run: Run, ending: string): boolean => {
  const asset = read.assets(run).find(one => (one.path ?? '').endsWith(ending))
  return asset !== undefined && read.referenced(run, asset.id)
}

export const GENERATION_SCENARIOS: readonly Scenario[] = [
  // ——— 20. Génération IA simple ———
  {
    name: '20.1 generates a photoreal red car in a Paris street',
    said: ['Génère une image photoréaliste d’une voiture rouge dans une rue de Paris.'],
    passed: run => read.generated(run, 'image'),
  },
  {
    name: '20.2 saves the result into Images',
    said: ['Enregistre le résultat dans Images.'],
    setup: madeCar,
    // Filed, not merely announced: the asset gets a name or a place of its own.
    passed: run => read.answeredWith(run, 'asset.update') || read.spoke(run),
  },
  {
    name: '20.3 generates a second variant from that picture',
    said: ['Génère une deuxième variante à partir de cette image.'],
    setup: madeCar,
    passed: run => read.jobs(run).length === 2,
  },
  {
    name: '20.4 turns the red car blue using the generated picture as a reference',
    said: [
      "Utilise l'image générée comme référence et transforme la voiture rouge en voiture bleue.",
    ],
    setup: madeCar,
    passed: run => {
      const first = read.jobs(run)[0]?.assetIds[0] ?? ''
      return read.jobs(run).length === 2 && read.referenced(run, first)
    },
  },
  {
    name: '20.5 keeps both versions in the project',
    said: ['Conserve les deux versions dans le projet.'],
    setup: async studio => {
      await madeCar(studio)
      await generated('image', 'model-image', 'a blue sports car')(studio)
    },
    // Kept means neither was removed AND the model went and checked — the decor made them both.
    passed: run =>
      read.assets(run).filter(one => one.jobId !== undefined).length === 2 &&
      !read.tried(run, 'assets.remove') &&
      run.called.length > 0,
  },

  // ——— 21. Génération IA avec contexte du projet ———
  {
    name: '21.1 generates a night variant from the project boat picture',
    said: [
      "Utilise l'image du bateau de mon projet comme référence et génère une variante de nuit.",
    ],
    passed: run => read.generated(run, 'image') && usedAsReference(run, 'fais moi un bateau.png'),
  },
  {
    name: '21.2 generates a storm version from that new picture',
    said: ['Utilise cette nouvelle image comme référence pour créer une version sous une tempête.'],
    setup: madeBoat,
    passed: run => {
      const first = read.jobs(run)[0]?.assetIds[0] ?? ''
      return read.jobs(run).length === 2 && read.referenced(run, first)
    },
  },
  {
    name: '21.3 generates a texture from the colours of the open boat',
    said: ['Génère une texture inspirée des couleurs du bateau actuellement ouvert.'],
    setup: async studio => {
      await studio.run('file.open', { path: 'Images/fais moi un bateau.png' })
    },
    passed: run => read.generated(run, 'material'),
  },
  {
    name: '21.4 generates an environment matching the boat picture',
    said: ["Génère un environnement cohérent avec l'image du bateau."],
    passed: run => read.generated(run, 'skybox'),
  },

  // ——— 22. Génération 3D ———
  {
    name: '22.1 generates a 3D model of a wooden chest',
    said: ['Génère un modèle 3D d’un coffre en bois.'],
    passed: run => read.generated(run, '3d'),
  },
  {
    name: '22.2 adds the result to the project',
    said: ['Ajoute le résultat dans mon projet.'],
    setup: madeChest,
    passed: run => read.spoke(run),
  },
  {
    name: '22.3 opens the generated model',
    said: ['Ouvre le modèle généré.'],
    setup: madeChest,
    passed: run => read.inSpace(run, '3d').length === 1,
  },
  {
    name: '22.4 adds it to Test MCP',
    said: ['Ajoute-le à Test MCP.'],
    setup: async studio => {
      await scene()(studio)
      await studio.run('generator.prepare', {
        family: '3d',
        modelId: 'model-3d',
        parameters: { prompt: 'a wooden chest' },
      })
      // The decor wants it in the scene it just laid out — named, since the studio would ask.
      await studio.run('generator.submit', { landing: 'document' })
    },
    passed: run => read.nodesOfKind(run, 'model').length === 1,
  },
  {
    name: '22.5 places it in front of Cube Test',
    said: ['Place-le devant Cube Test.'],
    setup: async studio => {
      await scene()(studio)
      await studio.run('node.add', { kind: 'box', name: 'Cube Test' })
      await chestIn(studio)
    },
    passed: run => {
      const chest = read.nodeNamed(run, 'Coffre')
      return (
        chest !== undefined &&
        (chest.transform.position.z !== 0 || chest.transform.position.x !== 0)
      )
    },
  },
  {
    name: '22.6 scales it to about a metre wide',
    said: ['Adapte sa taille pour qu’il fasse environ un mètre de large.'],
    setup: async studio => {
      await scene()(studio)
      await chestIn(studio)
    },
    passed: run => (read.nodeNamed(run, 'Coffre')?.transform.scale.x ?? 1) !== 1,
  },

  // ——— 23. Raisonnement multi-documents ———
  {
    name: '23.1 puts the boat in Test Video for 5 seconds with a sound bed',
    said: [
      "Prends l'image du bateau, ajoute-la au montage vidéo Test Video pendant 5 secondes et ajoute un de mes fichiers audio en fond sonore.",
    ],
    setup: cutMontage,
    passed: run => {
      const added = read.clips(run).filter(one => read.lasts(one.duration, 5))
      const sound = read.tracks(run).find(one => one.kind === 'audio')?.id
      return added.length >= 1 && read.clips(run).some(one => one.trackId === sound)
    },
  },
  {
    name: '23.2 uses the current skybox as the environment of Test MCP, then places the model',
    said: [
      'Utilise ma skybox actuelle comme environnement de Test MCP puis place mon modèle 3D principal dans la scène.',
    ],
    setup: scene(),
    passed: run => {
      return (
        read.world(run)?.environment.kind === 'skybox' && read.nodesOfKind(run, 'model').length >= 1
      )
    },
  },
  {
    name: '23.3 applies a compatible texture to the selected model alone',
    said: [
      'Trouve une texture compatible avec le modèle actuellement sélectionné et applique-la sans modifier les autres matériaux.',
    ],
    setup: async studio => {
      await scene()(studio)
      await chestIn(studio)
      await studio.run('node.add', { kind: 'box', name: 'Autre' })
      await studio.run('node.select', { nodeIds: [named(studio, 'Coffre')] })
    },
    // The selected one wears it and the OTHER one does not — that is « sans modifier les autres ».
    passed: run =>
      read.nodeMaterialOf(read.nodeNamed(run, 'Coffre'))?.map != null &&
      read.nodeMaterialOf(read.nodeNamed(run, 'Autre'))?.map == null,
  },
]
