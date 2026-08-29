import type { Studio } from './studio'
import type { Scenario } from './run'
import { ENVIRONMENT_PRESETS, matchesPreset } from '@/engines/scene/environmentPresets'
import * as read from './oracle'
import { cameraScene, cubeScene, madeCar, named, overlay, scene, testFolders } from './setups'

/** Sections 41 to 57 — the studio around the documents, and the machine around the studio. */

/** A camera with a shot already cut, which is what a rail is hung on. */
const shotScene = async (studio: Studio): Promise<void> => {
  await cameraScene(studio)
  await studio.run('camera.shot', { nodeId: named(studio, 'Camera Test') })
}

/** A scene with a path node in it — every `path.*` call refuses on anything else. */
const pathScene = async (studio: Studio): Promise<void> => {
  await cubeScene(studio)
  await studio.run('node.add', { kind: 'path', name: 'Chemin' })
}

/** A cube carrying two keys, so « efface la clé de 5 secondes » sorts one and leaves one. */
const keyedCube = async (studio: Studio): Promise<void> => {
  await cubeScene(studio)
  await studio.run('key.pose', { nodeId: named(studio, 'Cube Test'), timeSeconds: 0 })
  await studio.run('node.transform', { nodeId: named(studio, 'Cube Test'), positionY: 4 })
  await studio.run('key.pose', { nodeId: named(studio, 'Cube Test'), timeSeconds: 5 })
}

export const REST_SCENARIOS: readonly Scenario[] = [
  {
    name: '41.1 opens the Scène 1 document of the documents folder',
    said: ['Ouvre le document Scène 1 qui est dans mon dossier documents.'],
    passed: run => read.openedFile(run, 'Scène 1.gltf'),
  },
  {
    name: '41.2 renames the open document Scène Finale',
    said: ['Renomme ce document Scène Finale.'],
    setup: scene('Scène 1'),
    passed: run => read.titled(run, 'Scène Finale') !== undefined,
  },
  {
    name: '41.3 saves the open document',
    said: ['Enregistre le document ouvert.'],
    // 🛑 Read on the CALL and not on `modified`: `settle()` clears that flag before the person
    // speaks, so a model doing nothing at all would have passed.
    setup: cubeScene,
    passed: run => read.answeredWith(run, 'document.save'),
  },
  {
    name: '41.4 closes Scène Finale and deletes its file',
    said: ['Ferme Scène Finale et supprime son fichier du projet.'],
    setup: async studio => {
      await studio.run('file.open', { path: 'Modelling/Scenes/Scène 1.gltf' })
      await studio.run('document.rename', {
        documentId: studio.front()?.id ?? '',
        title: 'Scène Finale',
      })
    },
    passed: run =>
      read.titled(run, 'Scène Finale') === undefined &&
      !read.holds(run, 'Modelling/Scenes/Scène 1.gltf'),
  },
  {
    name: '41.5 exports the open scene into the documents folder',
    said: ['Exporte la scène ouverte dans mon dossier documents.'],
    setup: scene('Export Test'),
    passed: run => read.files(run).some(one => one.startsWith('Modelling/Scenes/Export Test.')),
  },
  {
    name: '41.6 makes a project called Démo Assistant',
    said: ['Crée un nouveau projet appelé Démo Assistant.'],
    passed: run => run.studio.projectName().includes('Démo Assistant'),
  },
  {
    name: '41.7 reopens the Démo project',
    said: ['Rouvre mon projet Démo.'],
    // Renamed away first, or « rouvre Démo » lands on the project already open and doing
    // nothing passes.
    setup: async studio => {
      await studio.run('project.open', { path: '/projets/Autre' })
    },
    passed: run => run.studio.projectName() === 'Démo',
  },
  {
    name: '41.8 renames the project Démo Assistant',
    said: ['Renomme mon projet Démo Assistant.'],
    passed: run => run.studio.projectName().includes('Démo Assistant'),
  },
  {
    name: '41.9 closes the open project',
    said: ['Ferme le projet ouvert.'],
    // The decor holds one open, so the empty name is the model's doing and not the bench's.
    passed: run => run.studio.projectName() === '',
  },

  {
    name: '42.1 copies the boat picture into Materials without moving it',
    said: ["Copie l'image du bateau dans mon dossier Materials sans la déplacer."],
    passed: run =>
      read.holds(run, 'Materials/fais moi un bateau.png') &&
      read.holds(run, 'Images/fais moi un bateau.png'),
  },
  {
    name: '42.2 gives the history of the last file operations',
    said: ['Montre-moi l’historique de mes dernières opérations sur les fichiers.'],
    setup: testFolders,
    passed: run => read.spoke(run) && read.answeredWith(run, 'files.history'),
  },
  {
    name: '42.3 says what was opened recently',
    said: ["Qu'est-ce que j'ai ouvert récemment dans ce projet ?"],
    passed: run => read.idle(run) && read.answeredWith(run, 'activity.recent'),
  },
  {
    name: '42.4 redoes what was just undone',
    said: ["Refais l'opération que je viens d'annuler."],
    // Made, then taken back: the folder has to be absent when the person speaks and back after.
    setup: async studio => {
      await studio.run('folder.new', { folder: '', name: 'Tests Assistant' })
      await studio.run('files.undo', {})
    },
    passed: run => read.holds(run, 'Tests Assistant'),
  },

  {
    name: '42.5 shows the boat picture in the Finder',
    said: ["Montre-moi l'image du bateau dans le Finder."],
    passed: run => run.studio.shell.revealed().some(one => one.includes('bateau')),
  },
  {
    name: '42.6 opens the information card of the boat picture',
    said: ["Ouvre la fiche d'informations de l'image du bateau."],
    passed: run => run.studio.shell.described().some(one => one.includes('bateau')),
  },

  {
    name: '43.1 gives what it holds on the boat picture',
    said: ["Donne-moi les informations que tu as sur l'image du bateau."],
    passed: run => read.idle(run) && read.answeredWith(run, 'asset.get'),
  },
  {
    name: '43.2 removes the generated picture from the library',
    said: ["Supprime de ma bibliothèque l'image que tu viens de générer."],
    setup: madeCar,
    passed: run => read.assets(run).every(one => one.jobId === undefined),
  },
  {
    name: '43.3 says whether any asset lost its file',
    said: ['Y a-t-il des assets de ma bibliothèque dont le fichier a disparu ?'],
    passed: run => read.idle(run) && read.answeredWith(run, 'assets.absent'),
  },
  {
    name: '43.4 describes the boat picture and files it under keywords',
    said: ["Décris-moi ce que représente l'image du bateau et range-la avec des mots-clés."],
    passed: run => read.assets(run).some(one => one.tags.length > 0),
  },
  {
    name: '43.5 shows that asset file on the disk',
    said: ["Montre-moi le fichier de l'image du bateau sur mon disque."],
    passed: run => run.studio.shell.revealed().length > 0,
  },
  {
    name: '43.6 says whether the account is connected',
    said: ['Suis-je connecté à mon compte Scenario ?'],
    passed: run => read.idle(run) && read.answeredWith(run, 'auth.state'),
  },
  {
    name: '43.7 says how many credits are left',
    said: ['Combien de crédits me reste-t-il ce mois-ci ?'],
    passed: run => read.idle(run) && read.answeredWith(run, 'usage.report'),
  },

  {
    name: '43.8 names the accounts on record',
    said: ['Quels comptes ai-je enregistrés ?'],
    passed: run => read.idle(run) && read.answeredWith(run, 'accounts.list'),
  },
  {
    name: '43.9 switches to the second account',
    said: ['Bascule sur mon deuxième compte.'],
    passed: run => run.studio.shell.accounts()[1]?.active === true,
  },
  {
    name: '43.10 renames that account Studio Perso',
    said: ['Renomme ce compte Studio Perso.'],
    passed: run => run.studio.shell.accounts().some(one => one.name === 'Studio Perso'),
  },

  {
    name: '44.1 says where the generations stand',
    said: ['Où en sont mes générations ?'],
    setup: madeCar,
    passed: run => read.idle(run) && read.answeredWith(run, 'jobs.list'),
  },
  {
    name: '44.2 gives the result of the last generation',
    said: ['Donne-moi le résultat de ma dernière génération.'],
    setup: madeCar,
    passed: run => read.idle(run) && read.answeredWith(run, 'job.get'),
  },
  {
    name: '44.3 cancels the generation under way',
    said: ['Annule la génération en cours.'],
    setup: madeCar,
    passed: run => read.jobs(run).some(one => one.status === 'cancelled'),
  },
  {
    name: '44.4 stops the indexing task that is running',
    said: ["Arrête la tâche d'indexation qui tourne."],
    passed: run => read.answeredWith(run, 'task.cancel'),
  },
  {
    name: '44.5 names the settings the armed image model accepts',
    said: ["Quels réglages accepte le modèle image que j'ai armé ?"],
    passed: run => read.idle(run) && read.answeredWith(run, 'model.schema'),
  },
  {
    name: '44.6 estimates what a generation would cost before it runs',
    said: ['Combien me coûterait cette génération avant que je la lance ?'],
    passed: run => read.idle(run) && read.answeredWith(run, 'cost.estimate'),
  },

  {
    name: '45.1 opens the preferences through the menu command',
    said: ['Ouvre les préférences par le menu, comme si je cliquais dessus.'],
    passed: run => read.answeredWith(run, 'command.run') || run.studio.shell.settingsOpen(),
  },
  {
    name: '45.2 says what it can do about layers',
    said: ['De quoi es-tu capable au sujet des calques ?'],
    passed: run => read.spoke(run) && read.answeredWith(run, 'actions.find'),
  },
  {
    name: '45.3 closes the chat window',
    said: ['Ferme la fenêtre de discussion.'],
    passed: run => read.answeredWith(run, 'chat.close'),
  },
  {
    name: '45.4 takes the Bateau layer as the target of what follows',
    said: ['Prends le calque Bateau comme cible de mes prochaines demandes.'],
    setup: overlay,
    // The named one, for the reason 39.3 gives: a picture always has an active layer.
    passed: run => read.aimed(run).ids[0] === read.layerNamed(run, 'Bateau')?.id,
  },

  {
    name: '45.5 suggests three prompts for a harbour at sunset',
    said: ['Propose-moi trois prompts pour générer un port au coucher du soleil.'],
    passed: run => read.spoke(run) && read.answeredWith(run, 'prompt.suggest'),
  },
  {
    name: '45.6 translates the prompt before it runs',
    said: [
      'Traduis ce prompt en anglais avant de le lancer : un bateau en bois sur une mer calme.',
    ],
    passed: run => read.spoke(run) && read.answeredWith(run, 'prompt.translate'),
  },
  {
    name: '45.7 describes the style of the boat picture as a reusable prompt',
    said: ['Décris-moi le style de mon image du bateau, en une phrase réutilisable comme prompt.'],
    passed: run => read.spoke(run) && read.answeredWith(run, 'prompt.describeStyle'),
  },
  {
    /**
     * 🛑 The QUESTION is what is measured, not the answer: written into a `say` it costs the
     * person a round of typing, where a pressed button comes back as this action's outcome.
     */
    name: '45.8 asks which space to work in, offering the three',
    said: ['Demande-moi dans quel espace travailler, en me proposant Image, Vidéo ou Audio.'],
    passed: run => read.answeredWith(run, 'chat.ask'),
  },

  {
    name: '46.1 turns the cube into a cylinder',
    said: ['Change le cube en cylindre.'],
    setup: cubeScene,
    passed: run => read.kindNamed(run, 'Cube Test') === 'cylinder',
  },
  {
    name: '46.2 adds a billboard carrying the boat picture',
    said: [
      'Ajoute un panneau plat qui porte l’image du bateau et qui fait toujours face à la caméra.',
    ],
    setup: cubeScene,
    // Two calls, and the second is the point: adding the sprite, then giving it its picture.
    passed: run => read.nodesOfKind(run, 'sprite').some(one => read.spriteOf(one)?.map != null),
  },
  {
    name: '46.3 adds a 3D text reading Studio above the cube',
    said: ['Ajoute un texte 3D qui dit Studio au-dessus du cube.'],
    setup: cubeScene,
    passed: run => read.nodes(run).some(one => read.wordsOf(one)?.value === 'Studio'),
  },
  {
    name: '46.4 traces a closed path from the cube to the right',
    said: ['Trace un chemin fermé qui part du cube et va vers la droite.'],
    setup: cubeScene,
    // Closed, and not merely there: adding the node is `node.add`'s doing, and the request says
    // « fermé », which is the only part `node.path` answers.
    passed: run => read.nodesOfKind(run, 'path').some(one => read.pathOf(one)?.closed === true),
  },
  {
    name: '46.5 adds a point two metres further along that path',
    said: ['Ajoute un point à ce chemin, deux mètres plus loin.'],
    setup: pathScene,
    passed: run =>
      // A fresh rail is born with two points, so a third is what « ajoute un point » leaves.
      (read.pathOf(read.nodeNamed(run, 'Chemin'))?.points.length ?? 0) >= 3,
  },
  {
    name: '46.6 moves the second point of the path a metre up',
    said: ['Déplace le deuxième point du chemin d’un mètre vers le haut.'],
    setup: async studio => {
      await pathScene(studio)
      await studio.run('path.addPoint', {
        nodeId: named(studio, 'Chemin'),
        pointX: 0,
        pointY: 0,
        pointZ: 0,
      })
      await studio.run('path.addPoint', {
        nodeId: named(studio, 'Chemin'),
        pointX: 2,
        pointY: 0,
        pointZ: 0,
      })
    },
    passed: run => (read.pathOf(read.nodeNamed(run, 'Chemin'))?.points[1]?.y ?? 0) !== 0,
  },
  {
    name: '46.7 removes the last point of the path',
    said: ['Supprime le dernier point du chemin.'],
    setup: async studio => {
      await pathScene(studio)
      await studio.run('path.addPoint', {
        nodeId: named(studio, 'Chemin'),
        pointX: 0,
        pointY: 0,
        pointZ: 0,
      })
      await studio.run('path.addPoint', {
        nodeId: named(studio, 'Chemin'),
        pointX: 2,
        pointY: 0,
        pointZ: 0,
      })
    },
    // Three of four: a fresh rail is born with two points and the decor adds two more.
    passed: run => read.pathOf(read.nodeNamed(run, 'Chemin'))?.points.length === 3,
  },
  {
    name: '46.8 files the sphere under the cube',
    said: ["Range la sphère sous le cube, pour qu'elle le suive quand je le déplace."],
    setup: async studio => {
      await cubeScene(studio)
      await studio.run('node.add', { kind: 'sphere', name: 'Sphere' })
    },
    passed: run => {
      const cube = read.nodeNamed(run, 'Cube Test')
      return cube !== undefined && read.nodeNamed(run, 'Sphere')?.parentId === cube.id
    },
  },
  {
    // The other half of the same action: where a node sits among its own level, which the
    // outliner reads off the order of the scene and nothing else says.
    name: '46.9 puts the sphere first in the scene list',
    said: ['Mets la sphère tout en haut de la liste de la scène.'],
    setup: async studio => {
      await cubeScene(studio)
      await studio.run('node.add', { kind: 'sphere', name: 'Sphere' })
    },
    // The top level IN ORDER: nothing else says where a node sits among its own.
    passed: run => read.nodes(run).filter(one => one.parentId === null)[0]?.name === 'Sphere',
  },

  {
    name: '47.1 cuts a rail for the camera shot',
    said: ['Crée un rail de caméra qui part de la gauche et arrive à droite du cube.'],
    setup: shotScene,
    // A rail IS a path node — `railForShot` adds one and names it on the shot.
    passed: run => read.nodesOfKind(run, 'path').length === 1,
  },
  {
    name: '47.2 makes Camera Test follow that rail',
    said: ['Fais suivre ce rail à Camera Test.'],
    setup: shotScene,
    passed: run => read.shots(run).some(one => one.motion !== undefined),
  },
  {
    name: '47.3 puts Camera Test first in the camera list',
    said: ['Mets Camera Test en premier dans la liste des caméras.'],
    setup: async studio => {
      await cubeScene(studio)
      await studio.run('node.add', { kind: 'camera', name: 'Camera Test' })
    },
    passed: run => read.nodes(run)[0]?.name.includes('Camera Test') === true,
  },
  {
    name: '47.4 switches the view to a top view',
    said: ['Passe la vue en vue de dessus.'],
    setup: cubeScene,
    passed: run => read.answeredWith(run, 'view.direction'),
  },
  {
    name: '47.5 shows the scene as a wireframe',
    said: ['Affiche la scène en fil de fer.'],
    setup: cubeScene,
    passed: run => read.sceneView(run)?.displays.includes('wireframe') === true,
  },

  {
    name: '47.6 captures the current view into the pictures',
    said: ['Prends une capture de la vue actuelle et range-la dans mes images.'],
    setup: cubeScene,
    passed: run => read.answeredWith(run, 'scene.capture'),
  },

  {
    name: '48.1 applies a studio lighting preset to the scene',
    said: ["Applique un préréglage d'éclairage de studio à la scène."],
    setup: cubeScene,
    // `matchesPreset` is the studio's own reading: no preset NAME is stored, only what it wrote.
    passed: run => {
      const world = read.world(run)
      return world !== null && ENVIRONMENT_PRESETS.some(one => matchesPreset(world, one))
    },
  },
  {
    name: '48.2 adds a light fog',
    said: ['Ajoute un brouillard léger.'],
    setup: cubeScene,
    passed: run => read.world(run)?.fog.kind !== 'none',
  },
  {
    name: '48.3 puts a ground under the objects',
    said: ['Ajoute un sol sous mes objets.'],
    setup: cubeScene,
    passed: run => read.world(run)?.ground.visible === true,
  },
  {
    name: '48.4 puts the render at its highest quality',
    said: ['Passe le rendu en qualité maximale.'],
    setup: cubeScene,
    passed: run => read.world(run)?.toneMapping !== 'none',
  },

  {
    name: '49.1 names the animations the scene carries',
    said: ['Quelles animations porte cette scène ?'],
    setup: keyedCube,
    passed: run => read.spoke(run) && read.answeredWith(run, 'animations.list'),
  },
  {
    name: '49.2 cuts that animation into a block from 0 to 5 seconds',
    said: ['Découpe cette animation en un bloc de 0 à 5 secondes.'],
    setup: async studio => {
      await keyedCube(studio)
      await studio.run('key.pose', { nodeId: named(studio, 'Cube Test'), timeSeconds: 9 })
    },
    passed: run => !read.keys(run).some(one => one.time > 5 * read.SECOND),
  },
  {
    name: '49.3 switches automatic keying on',
    said: ['Active la pose automatique de clés pendant que je travaille.'],
    setup: keyedCube,
    passed: run => read.animationView(run)?.autoKey === true,
  },
  {
    name: '49.4 clears the key sitting at 5 seconds',
    said: ['Efface la clé posée à 5 secondes.'],
    setup: keyedCube,
    // Three left of six: `key.pose` writes position, rotation AND scale, so the decor lays two
    // keys on each of the three channels.
    passed: run => {
      const left = read.keys(run)
      return left.length === 3 && !left.some(one => read.lasts(one.time, 5))
    },
  },
  {
    name: '49.5 clears every key of Cube Test',
    said: ['Efface toutes les clés de Cube Test.'],
    setup: keyedCube,
    passed: run => read.keys(run).length === 0,
  },
  {
    name: '49.6 shifts every key of Cube Test two seconds later',
    said: ['Décale toutes les clés de Cube Test de 2 secondes vers la droite.'],
    setup: keyedCube,
    passed: run => read.keys(run).some(one => read.lasts(one.time, 7)),
  },
  {
    name: '49.7 loops the rotation channel of Cube Test',
    said: ['Boucle le canal de rotation de Cube Test.'],
    setup: keyedCube,
    passed: run => read.answeredWith(run, 'channel.flags'),
  },
]
