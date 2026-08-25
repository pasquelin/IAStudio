import type { FakeStudio } from './fakeStudio'
import type { Run, Scenario } from './run'
import * as read from './oracle'
import { boatImage, cutMontage, layerAt, madeCar, modelScene, overlay, trackAt } from './setups'

/**
 * Sections 53 to 57: the surfaces around the documents — styles, the online library, the window
 * and its panels, the machine, and what the assistant is told to remember about the project.
 */

const idle = (run: Run): boolean => read.spoke(run) && read.lookedOnly(run)

const shellOf = (run: Run) => run.studio.bench().shell

const styled =
  (name = 'Marine') =>
  (studio: FakeStudio): void => {
    studio.run('style.save', { name })
  }

const withPanel = (studio: FakeStudio): void => {
  studio.run('panel.open', { panel: 'layers' })
}

/** The knight with a skeleton already fitted — nine of the ten rig requests start from one. */
const rigged = (studio: FakeStudio): void => {
  modelScene(studio)
  studio.run('rig.fit', { nodeId: studio.front()?.nodes[0]?.id ?? '' })
}

/** The boat picture with its two layers filed under a group. */
const grouped = (studio: FakeStudio): void => {
  overlay(studio)
  studio.run('layer.group', {
    layerIds: [layerAt(studio, 0), layerAt(studio, 1)],
    name: 'Fond',
  })
}

const guided = (studio: FakeStudio): void => {
  boatImage(studio)
  // 'x' and not 'vertical': `GUIDE_AXES` is ['x', 'y'], and the decor was refused in silence.
  studio.run('guide.add', { axis: 'x', position: 960 })
}

const remembered = (studio: FakeStudio): void => {
  studio.run('context.write', { cardId: 'card-1', title: 'Style', body: 'rendu photoréaliste' })
}

const rigOf = (run: Run) => read.inSpace(run, '3d')[0]?.rig

const imageOf = (run: Run) => read.inSpace(run, 'image')[0]

export const SHELL_SCENARIOS: readonly Scenario[] = [
  {
    name: '50.1 says whether the model already has a skeleton',
    said: ['Ce personnage a-t-il déjà un squelette ?'],
    setup: modelScene,
    passed: run => read.spoke(run) && read.answeredWith(run, 'rig.state'),
  },
  {
    name: '50.2 fits a skeleton to the model',
    said: ['Pose un squelette adapté à sa taille.'],
    setup: modelScene,
    passed: run => rigOf(run)?.fitted === true,
  },
  {
    name: '50.3 adds the hands to that skeleton',
    said: ['Ajoute les mains à ce squelette.'],
    setup: rigged,
    passed: run => rigOf(run)?.hands === true,
  },
  {
    name: '50.4 adds one more bone at the end of the right arm',
    said: ['Ajoute un os supplémentaire au bout de son bras droit.'],
    setup: rigged,
    passed: run => (rigOf(run)?.bones.length ?? 0) === 4,
  },
  {
    name: '50.5 renames that bone Main Droite',
    said: ['Renomme cet os Main Droite.'],
    setup: rigged,
    passed: run => rigOf(run)?.bones.some(one => one.name === 'Main Droite') === true,
  },
  {
    name: '50.6 says that bone is the right hand',
    said: ['Dis que cet os est la main droite du personnage.'],
    setup: rigged,
    // A role the fit did not already lay: the three it poses are hips and the two upper limbs.
    passed: run => rigOf(run)?.bones.some(one => one.role === 'rightHand') === true,
  },
  {
    name: '50.7 removes the bone just added',
    said: ["Supprime l'os Bras Droit."],
    setup: rigged,
    passed: run => rigOf(run)?.bones.some(one => one.name === 'Bras Droit') === false,
  },
  {
    name: '50.8 adds an IK constraint on the left leg',
    said: ['Ajoute une contrainte IK sur sa jambe gauche.'],
    setup: rigged,
    passed: run => (rigOf(run)?.iks.length ?? 0) === 1,
  },
  {
    name: '50.9 takes that IK constraint back off',
    said: ['Retire cette contrainte IK.'],
    setup: studio => {
      rigged(studio)
      studio.run('ik.add', { nodeId: studio.front()?.nodes[0]?.id ?? '', bone: 'Jambe Gauche' })
    },
    passed: run => rigOf(run)?.iks.length === 0,
  },
  {
    name: '50.10 clears the skeleton off the model',
    said: ['Enlève complètement le squelette de ce personnage.'],
    setup: rigged,
    passed: run => rigOf(run)?.fitted === false,
  },

  {
    name: '51.1 groups the two layers under Fond',
    said: ['Regroupe mes deux calques dans un groupe appelé Fond.'],
    setup: overlay,
    passed: run => read.layers(run).some(one => one.kind === 'group'),
  },
  {
    name: '51.2 ungroups Fond',
    said: ['Dégroupe le groupe Fond.'],
    setup: grouped,
    passed: run => read.layers(run).every(one => one.kind !== 'group'),
  },
  {
    name: '51.3 merges the top layer into the one below',
    said: ["Fusionne le calque du dessus avec celui d'en dessous."],
    setup: studio => {
      overlay(studio)
      studio.run('layer.select', { layerId: layerAt(studio, 1) })
    },
    passed: run => read.layers(run).length === 1,
  },
  {
    name: '51.4 adds a red rectangle at the bottom of the picture',
    said: ["Ajoute un rectangle rouge en bas de l'image."],
    setup: boatImage,
    passed: run => read.layers(run).some(one => one.kind === 'shape'),
  },
  {
    name: '51.5 adds an adjustment layer raising the contrast',
    said: ['Ajoute un calque de réglage qui monte le contraste.'],
    setup: boatImage,
    passed: run => read.layers(run).some(one => one.kind === 'adjustment'),
  },
  {
    name: '51.6 adds a mask to the Bateau layer',
    said: ['Ajoute un masque au calque Bateau.'],
    setup: boatImage,
    passed: run => read.layerNamed(run, 'Bateau')?.masked === true,
  },
  {
    name: '51.7 crops the picture to a centred square',
    said: ["Recadre l'image sur un carré centré."],
    setup: boatImage,
    passed: run => imageOf(run)?.width === imageOf(run)?.height,
  },
  {
    name: '51.8 turns the document 90 degrees clockwise',
    said: ['Fais pivoter le document de 90 degrés vers la droite.'],
    setup: boatImage,
    passed: run => imageOf(run)?.width === 1080 && imageOf(run)?.height === 1920,
  },
  {
    name: '51.9 lays a vertical guide down the middle',
    said: ["Pose un repère vertical au milieu de l'image."],
    setup: boatImage,
    passed: run => imageOf(run)?.guides.length === 1,
  },
  {
    name: '51.10 moves that guide to a third of the width',
    said: ['Déplace ce repère au tiers de la largeur.'],
    setup: guided,
    passed: run => read.near(imageOf(run)?.guides[0]?.at ?? 960, 640, 40),
  },
  {
    name: '51.11 removes that guide',
    said: ['Supprime ce repère.'],
    setup: guided,
    passed: run => imageOf(run)?.guides.length === 0,
  },

  {
    name: '52.1 unlinks the sound of the first video',
    said: ['Détache le son de ma première vidéo pour pouvoir le déplacer seul.'],
    setup: cutMontage,
    passed: run => read.clips(run).some(one => !one.linked),
  },
  {
    name: '52.2 moves the sound row above the picture row',
    said: ['Fais passer la piste audio au-dessus de la piste vidéo.'],
    setup: studio => {
      cutMontage(studio)
      trackAt(studio, 0)
    },
    passed: run => read.documents(run).flatMap(one => one.tracks)[0]?.kind === 'audio',
  },

  {
    name: '53.1 names the styles on record',
    said: ['Quels styles ai-je enregistrés ?'],
    setup: styled(),
    passed: run => idle(run) && read.answeredWith(run, 'styles.list'),
  },
  {
    name: '53.2 saves the boat picture style under the name Marine',
    said: ['Enregistre le style de mon image du bateau sous le nom Marine.'],
    setup: madeCar,
    passed: run => shellOf(run).styles.some(one => one.name === 'Marine'),
  },
  {
    name: '53.3 renames that style Marine Nuit',
    said: ['Renomme ce style Marine Nuit.'],
    setup: styled(),
    passed: run => shellOf(run).styles.some(one => one.name === 'Marine Nuit'),
  },
  {
    name: '53.4 removes the Marine Nuit style',
    said: ['Supprime le style Marine Nuit.'],
    setup: styled('Marine Nuit'),
    passed: run => shellOf(run).styles.length === 0,
  },

  {
    name: '54.1 shows what the online library holds',
    said: ['Montre-moi ce que contient ma bibliothèque en ligne.'],
    passed: run => idle(run) && read.answeredWith(run, 'cloud.browse'),
  },
  {
    name: '54.2 searches the online library for red cars',
    said: ['Cherche des voitures rouges dans ma bibliothèque en ligne.'],
    passed: run =>
      idle(run) &&
      (read.answeredWith(run, 'cloud.explore') || read.answeredWith(run, 'cloud.browse')),
  },
  {
    name: '54.3 finds online pictures close to the boat',
    said: ['Trouve-moi en ligne des images qui ressemblent à mon bateau.'],
    passed: run => idle(run) && read.answeredWith(run, 'cloud.similar'),
  },
  {
    name: '54.4 says what a sync would bring, before running it',
    said: ['Dis-moi ce que téléchargerait une synchronisation, avant de la lancer.'],
    passed: run => idle(run) && read.answeredWith(run, 'cloud.plan'),
  },
  {
    name: '54.5 pulls the online pictures missing here',
    said: ['Télécharge dans mon projet les images en ligne qui manquent ici.'],
    passed: run => shellOf(run).pulled.length > 0,
  },
  {
    name: '54.6 sends the boat picture to the online library',
    said: ["Envoie l'image du bateau dans ma bibliothèque en ligne."],
    passed: run => shellOf(run).pushed.length > 0,
  },

  {
    name: '55.1 says what state the window is in',
    said: ['Dans quel état est ma fenêtre en ce moment ?'],
    passed: run => idle(run) && read.answeredWith(run, 'window.state'),
  },
  {
    name: '55.2 goes full screen',
    said: ['Passe en plein écran.'],
    passed: run => shellOf(run).fullScreen,
  },
  {
    name: '55.3 opens the preferences',
    said: ['Ouvre les préférences.'],
    passed: run => shellOf(run).settingsOpen,
  },
  {
    name: '55.4 names the panels that can be opened',
    said: ['Quels panneaux puis-je ouvrir ?'],
    passed: run => idle(run) && read.answeredWith(run, 'panels.list'),
  },
  {
    name: '55.5 opens the layers panel',
    said: ['Ouvre le panneau des calques.'],
    passed: run => shellOf(run).panels.length > 0,
  },
  {
    name: '55.6 closes the layers panel',
    said: ['Ferme le panneau des calques.'],
    setup: withPanel,
    passed: run => shellOf(run).panels.length === 0,
  },
  {
    name: '55.7 opens a mirror of the view on the second screen',
    said: ['Ouvre un miroir de la vue sur mon second écran.'],
    passed: run => shellOf(run).mirrored,
  },
  {
    name: '55.8 opens the manual at the video montage chapter',
    said: ['Ouvre le manuel au chapitre du montage vidéo.'],
    passed: run => shellOf(run).helpAt !== null,
  },
  {
    name: '55.9 names the favourites',
    said: ['Quels sont mes favoris ?'],
    passed: run => idle(run) && read.answeredWith(run, 'favorites.list'),
  },
  {
    name: '55.10 pins the boat picture as a favourite',
    said: ["Mets l'image du bateau en favori."],
    passed: run => shellOf(run).favorites.length === 1,
  },
  {
    name: '55.11 unpins the boat picture',
    said: ["Retire l'image du bateau de mes favoris."],
    setup: studio => {
      studio.run('favorite.pin', {
        assetId: read.assetOf(studio, 'fais moi un bateau.png'),
      })
    },
    passed: run => shellOf(run).favorites.length === 0,
  },

  {
    name: '56.1 says whether an update is available',
    said: ['Une mise à jour est-elle disponible ?'],
    passed: run => idle(run) && read.answeredWith(run, 'updates.state'),
  },
  {
    name: '56.2 installs the update and restarts',
    said: ['Installe la mise à jour et redémarre.'],
    passed: run => shellOf(run).updateInstalled,
  },
  {
    name: '56.3 says whether dictation is ready',
    said: ['La dictée est-elle prête à être utilisée ?'],
    passed: run => idle(run) && read.answeredWith(run, 'dictation.state'),
  },
  {
    name: '56.4 starts the dictation',
    said: ['Lance la dictée.'],
    passed: run => shellOf(run).dictating,
  },
  {
    name: '56.5 stops the dictation',
    said: ['Arrête la dictée.'],
    setup: studio => {
      studio.run('dictation.start', {})
    },
    passed: run => !shellOf(run).dictating && read.tried(run, 'dictation.stop'),
  },
  {
    name: '56.6 says whether the machine encodes video in hardware',
    said: ['Mon ordinateur peut-il encoder de la vidéo en accéléré matériel ?'],
    passed: run => idle(run) && read.answeredWith(run, 'media.capabilities'),
  },
  {
    name: '56.7 adopts the video just dropped on the window',
    said: ['Ajoute à mon projet la vidéo que je viens de déposer sur la fenêtre.'],
    passed: run => shellOf(run).adopted.length > 0,
  },
  {
    name: '56.8 names the fonts a text could use',
    said: ['Quelles polices puis-je utiliser pour un texte ?'],
    passed: run => idle(run) && read.answeredWith(run, 'fonts.list'),
  },

  {
    name: '57.1 gives the current 3D settings',
    said: ['Quels sont mes réglages 3D actuels ?'],
    passed: run => idle(run) && read.answeredWith(run, 'settings.read'),
  },
  {
    name: '57.2 puts the display settings back to their defaults',
    said: ["Remets les réglages d'affichage à leurs valeurs par défaut."],
    passed: run => read.tried(run, 'settings.action') || read.tried(run, 'settings.write'),
  },
  {
    name: '57.3 says what it has remembered about the project',
    said: ["Qu'as-tu retenu de ce projet jusqu'ici ?"],
    setup: remembered,
    passed: run => idle(run) && read.answeredWith(run, 'context.read'),
  },
  {
    name: '57.4 remembers the project aims at photoreal marine work',
    said: ['Retiens que ce projet vise un rendu photoréaliste marine.'],
    passed: run => Object.keys(shellOf(run).context).length === 1,
  },
  {
    name: '57.5 forgets what it had remembered about the style',
    said: ['Oublie ce que tu avais retenu sur le style de ce projet.'],
    setup: remembered,
    passed: run => Object.keys(shellOf(run).context).length === 0,
  },
]
