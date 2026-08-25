import type { Run, Scenario } from './run'
import * as read from './oracle'
import { cubeScene, cutMontage, framedModel, modelScene } from './setups'

/**
 * Sections 31 to 36: a whole scene, a whole montage, from ONE sentence.
 *
 * 🛑 These oracles are conjunctions on purpose. « Crée une scène, ajoute le modèle, ajoute une
 * caméra qui le cadre, un environnement, une lumière, dix secondes et un tour complet » is seven
 * things, and a scenario that passed on three of them would report a plan as carried out when
 * more than half of it never ran.
 */

const turned = (run: Run): boolean => read.keys(run).some(one => one.channel.endsWith('rotation'))

export const PLANNING_SCENARIOS: readonly Scenario[] = [
  // ——— 31. Planification complexe ———
  {
    name: '31.1 builds Demo Assistant whole from one sentence',
    said: [
      'Crée une scène 3D vide appelée Demo Assistant, ajoute mon modèle 3D principal au centre, ajoute une caméra qui le cadre entièrement, utilise ma première skybox comme environnement, ajoute une lumière directionnelle, règle la durée à 10 secondes et fais faire un tour complet au modèle pendant ces 10 secondes.',
    ],
    passed: run => {
      const made = read.titled(run, 'Demo Assistant')
      return (
        made?.space === '3d' &&
        read.nodesOfKind(run, 'model').length >= 1 &&
        read.framing(run) &&
        made.world.environment !== null &&
        read.nodesOfKind(run, 'directional').length >= 1 &&
        read.near(made.duration, 10, 0.01) &&
        turned(run)
      )
    },
  },

  // ——— 32. Cross-media complexe ———
  {
    name: '32.1 builds a whole test montage from one sentence',
    said: [
      'Crée un montage vidéo de test avec mon image du bateau pendant 5 secondes, ajoute ensuite ma première vidéo, ajoute un fond sonore depuis mes fichiers audio, règle le son à 40 %, ajoute un fondu au début et assure-toi que le montage se termine exactement à la fin du dernier clip vidéo.',
    ],
    passed: run => {
      const made = read.documents(run).find(one => one.space === 'video')
      if (!made) return false

      const sound = made.tracks.find(one => one.kind === 'audio')?.id
      const sounds = made.clips.filter(one => one.trackId === sound)
      const pictures = made.clips.filter(one => one.trackId !== sound)
      const end = read.endOf(pictures)
      return (
        pictures.length >= 2 &&
        pictures.some(one => read.lasts(one.duration, 5)) &&
        sounds.length >= 1 &&
        sounds.every(one => read.quietedTo(one.gain, 40)) &&
        made.clips.some(one => one.fadeIn > 0) &&
        sounds.every(one => read.near(one.start + one.duration, end, read.SECOND / 100))
      )
    },
  },

  // ——— 33. IA + projet + édition ———
  {
    name: '33.1 generates a night boat, then cuts both versions with a sound bed',
    said: [
      "Utilise mon image du bateau comme référence pour générer une version de nuit, ajoute le résultat dans mon projet, crée un nouveau montage vidéo, affiche l'image originale pendant 3 secondes puis la version de nuit pendant 3 secondes et ajoute un de mes fichiers audio en fond.",
    ],
    passed: run => {
      const boat = read.assets(run).find(one => (one.path ?? '').endsWith('fais moi un bateau.png'))
      const made = read.documents(run).find(one => one.space === 'video')
      if (!boat || !made) return false

      const sound = made.tracks.find(one => one.kind === 'audio')?.id
      const shown = made.clips.filter(one => one.trackId !== sound)
      return (
        read.referenced(run, boat.id) &&
        shown.length >= 2 &&
        shown.filter(one => read.lasts(one.duration, 3)).length >= 2 &&
        made.clips.some(one => one.trackId === sound)
      )
    },
  },

  // ——— 34. Compréhension autonome d'une scène ———
  {
    name: '34.1 reads the scene and names what could go wrong, touching nothing',
    said: [
      'Analyse la scène 3D actuelle et dis-moi ce qui pourrait poser problème avant de modifier quoi que ce soit.',
    ],
    setup: modelScene,
    passed: run => read.spoke(run) && read.changedNothing(run),
  },
  {
    name: '34.2 fixes the simple problems without changing the intent',
    said: [
      'Corrige automatiquement les problèmes simples que tu peux résoudre sans changer l’intention de la scène.',
    ],
    setup: modelScene,
    // A scene with no light and no camera has two simple problems, and both are addable.
    passed: run =>
      read.nodesOfKind(run, 'directional', 'point', 'spot', 'ambient').length >= 1 ||
      read.nodesOfKind(run, 'camera').length >= 1,
  },
  {
    name: '34.3 says exactly what it changed',
    said: [
      'Analyse la scène 3D actuelle et dis-moi ce qui pourrait poser problème avant de modifier quoi que ce soit.',
      'Corrige automatiquement les problèmes simples que tu peux résoudre sans changer l’intention de la scène.',
      'Dis-moi précisément ce que tu as changé.',
    ],
    setup: modelScene,
    passed: run => read.spoke(run),
  },

  // ——— 35. Vérification après action ———
  {
    name: '35.1 checks every asked-for change really landed on Test MCP',
    said: [
      'Vérifie que toutes les actions que je t’ai demandé d’effectuer sur Test MCP ont réellement été appliquées.',
    ],
    setup: cubeScene,
    passed: run => read.spoke(run) && read.answeredWith(run, 'scene.state'),
  },
  {
    name: '35.2 compares the scene with what was asked',
    said: ['Compare l’état actuel de la scène avec ce que je t’ai demandé.'],
    setup: cubeScene,
    passed: run => read.spoke(run) && read.changedNothing(run),
  },
  {
    name: '35.3 lists only what did not produce the expected result',
    said: ['Liste uniquement les actions qui n’ont pas produit le résultat attendu.'],
    setup: cubeScene,
    passed: run => read.spoke(run) && read.changedNothing(run),
  },

  // ——— 36. Final — « directeur de studio » ———
  {
    name: '36.1 makes the whole scene itself, generating nothing new',
    said: [
      'Je veux une petite scène avec mon personnage principal au centre, un éclairage de studio, une caméra qui le cadre entièrement et un environnement adapté. Fais la scène toi-même en utilisant ce qui existe déjà dans mon projet. Ajoute ensuite une animation de caméra de 5 secondes qui se rapproche doucement du personnage tout en continuant à le regarder. Ne génère aucun nouvel asset si ce n’est pas nécessaire.',
    ],
    passed: run => {
      const made = read.inSpace(run, '3d')[0]
      const camera = read.nodesOfKind(run, 'camera')[0]
      return (
        made !== undefined &&
        read.nodesOfKind(run, 'model').length >= 1 &&
        read.nodesOfKind(run, 'directional', 'point', 'spot', 'ambient').length >= 1 &&
        (camera?.targetId ?? null) !== null &&
        made.world.environment !== null &&
        read.keys(run).some(one => read.near(one.at, 5, 0.01)) &&
        // « ne génère aucun nouvel asset » is half the request, and it is scored.
        !read.generated(run)
      )
    },
  },
  {
    name: '36.2 turns that scene into a ten-second montage ready for export',
    said: [
      'Transforme maintenant cette scène en un montage vidéo de 10 secondes, ajoute une musique de mon projet adaptée et prépare le montage pour l’export.',
    ],
    setup: framedModel,
    passed: run => {
      const made = read.documents(run).find(one => one.space === 'video')
      if (!made) return false

      const sound = made.tracks.find(one => one.kind === 'audio')?.id
      return read.lasts(made.duration, 10) && made.clips.some(one => one.trackId === sound)
    },
  },
  {
    name: '36.3 checks its own work and names what is left wrong',
    said: [
      'Vérifie tout ce que tu viens de faire et indique-moi les éventuelles erreurs ou incohérences restantes.',
    ],
    setup: cutMontage,
    passed: run => read.spoke(run) && read.changedNothing(run),
  },
]
