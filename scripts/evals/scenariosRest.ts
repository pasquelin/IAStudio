import type { FakeStudio } from './fakeStudio'
import type { Run, Scenario } from './run'
import * as read from './oracle'
import { cubeScene, cameraScene, madeCar, nodeAt, scene, testFolders } from './setups'

/**
 * Sections 41 to 57, the share the fake studio can already play. The rest of each section waits
 * on a family being modelled — `coverage.ts` names which, and the bench would otherwise score
 * them blind.
 */

const idle = (run: Run): boolean => read.spoke(run) && read.lookedOnly(run)

/** A scene with a sprite in it — `node.sprite` refuses anything that is not one. */
const spriteScene = (studio: FakeStudio): void => {
  cubeScene(studio)
  studio.run('node.add', { kind: 'sprite', name: 'Panneau' })
}

/** A camera with a shot already cut, which is what a rail is hung on. */
const shotScene = (studio: FakeStudio): void => {
  cameraScene(studio)
  studio.run('camera.shot', { nodeId: nodeAt(studio, 1) })
}

/** A scene with a path node in it — every `path.*` call refuses on anything else. */
const pathScene = (studio: FakeStudio): void => {
  cubeScene(studio)
  studio.run('node.add', { kind: 'path', name: 'Chemin' })
}

/** A cube carrying two keys, so « efface la clé de 5 secondes » sorts one and leaves one. */
const keyedCube = (studio: FakeStudio): void => {
  cubeScene(studio)
  studio.run('key.pose', { nodeId: nodeAt(studio, 0), timeSeconds: 0 })
  studio.run('node.transform', { nodeId: nodeAt(studio, 0), positionY: 4 })
  studio.run('key.pose', { nodeId: nodeAt(studio, 0), timeSeconds: 5 })
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
    setup: studio => {
      studio.run('file.open', { path: 'documents/Scène 1.gltf' })
      studio.run('document.rename', {
        documentId: studio.front()?.id ?? '',
        title: 'Scène Finale',
      })
    },
    passed: run =>
      read.titled(run, 'Scène Finale') === undefined && !read.holds(run, 'documents/Scène 1.gltf'),
  },
  {
    name: '41.5 exports the open scene into the documents folder',
    said: ['Exporte la scène ouverte dans mon dossier documents.'],
    setup: scene('Export Test'),
    passed: run => read.files(run).some(one => one.startsWith('documents/Export Test.')),
  },
  {
    name: '41.6 makes a project called Démo Assistant',
    said: ['Crée un nouveau projet appelé Démo Assistant.'],
    passed: run => run.studio.bench().projectName.includes('Démo Assistant'),
  },
  {
    name: '41.7 reopens the Démo project',
    said: ['Rouvre mon projet Démo.'],
    // Renamed away first, or « rouvre Démo » lands on the project already open and doing
    // nothing passes.
    setup: studio => {
      studio.run('project.open', { path: '/projets/Autre' })
    },
    passed: run => run.studio.bench().projectName === 'Démo',
  },
  {
    name: '41.8 renames the project Démo Assistant',
    said: ['Renomme mon projet Démo Assistant.'],
    passed: run => run.studio.bench().projectName.includes('Démo Assistant'),
  },

  {
    name: '42.1 copies the boat picture into Textures without moving it',
    said: ["Copie l'image du bateau dans mon dossier Textures sans la déplacer."],
    passed: run =>
      read.holds(run, 'Textures/fais moi un bateau.png') &&
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
    passed: run => idle(run) && read.answeredWith(run, 'activity.recent'),
  },
  {
    name: '42.4 redoes what was just undone',
    said: ["Refais l'opération que je viens d'annuler."],
    // Made, then taken back: the folder has to be absent when the person speaks and back after.
    setup: studio => {
      studio.run('folder.new', { folder: '', name: 'Tests Assistant' })
      studio.run('files.undo', {})
    },
    passed: run => read.holds(run, 'Tests Assistant'),
  },

  {
    name: '42.5 shows the boat picture in the Finder',
    said: ["Montre-moi l'image du bateau dans le Finder."],
    passed: run => run.studio.bench().shell.revealed.some(one => one.includes('bateau')),
  },
  {
    name: '42.6 opens the information card of the boat picture',
    said: ["Ouvre la fiche d'informations de l'image du bateau."],
    passed: run => run.studio.bench().shell.revealed.some(one => one.includes('bateau')),
  },

  {
    name: '43.1 gives what it holds on the boat picture',
    said: ["Donne-moi les informations que tu as sur l'image du bateau."],
    passed: run => idle(run) && read.answeredWith(run, 'asset.get'),
  },
  {
    name: '43.2 removes the generated picture from the library',
    said: ["Supprime de ma bibliothèque l'image que tu viens de générer."],
    setup: madeCar,
    passed: run => read.assets(run).every(one => one.jobId === null),
  },
  {
    name: '43.3 says whether any asset lost its file',
    said: ['Y a-t-il des assets de ma bibliothèque dont le fichier a disparu ?'],
    passed: run => idle(run) && read.answeredWith(run, 'assets.absent'),
  },
  {
    name: '43.4 describes the boat picture and files it under keywords',
    said: ["Décris-moi ce que représente l'image du bateau et range-la avec des mots-clés."],
    passed: run => read.assets(run).some(one => one.tags.length > 0),
  },
  {
    name: '43.5 shows that asset file on the disk',
    said: ["Montre-moi le fichier de l'image du bateau sur mon disque."],
    passed: run => run.studio.bench().shell.revealed.length > 0,
  },
  {
    name: '43.6 says whether the account is connected',
    said: ['Suis-je connecté à mon compte Scenario ?'],
    passed: run => idle(run) && read.answeredWith(run, 'auth.state'),
  },
  {
    name: '43.7 says how many credits are left',
    said: ['Combien de crédits me reste-t-il ce mois-ci ?'],
    passed: run => idle(run) && read.answeredWith(run, 'usage.report'),
  },

  {
    name: '43.8 names the accounts on record',
    said: ['Quels comptes ai-je enregistrés ?'],
    passed: run => idle(run) && read.answeredWith(run, 'accounts.list'),
  },
  {
    name: '43.9 switches to the second account',
    said: ['Bascule sur mon deuxième compte.'],
    passed: run => run.studio.bench().shell.accounts[1]?.active === true,
  },
  {
    name: '43.10 renames that account Studio Perso',
    said: ['Renomme ce compte Studio Perso.'],
    passed: run => run.studio.bench().shell.accounts.some(one => one.name === 'Studio Perso'),
  },

  {
    name: '44.1 says where the generations stand',
    said: ['Où en sont mes générations ?'],
    setup: madeCar,
    passed: run => idle(run) && read.answeredWith(run, 'jobs.list'),
  },
  {
    name: '44.2 gives the result of the last generation',
    said: ['Donne-moi le résultat de ma dernière génération.'],
    setup: madeCar,
    passed: run => idle(run) && read.answeredWith(run, 'job.get'),
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
    passed: run => idle(run) && read.answeredWith(run, 'model.schema'),
  },
  {
    name: '44.6 estimates what a generation would cost before it runs',
    said: ['Combien me coûterait cette génération avant que je la lance ?'],
    passed: run => idle(run) && read.answeredWith(run, 'cost.estimate'),
  },

  {
    name: '45.1 opens the preferences through the menu command',
    said: ['Ouvre les préférences par le menu, comme si je cliquais dessus.'],
    passed: run => read.answeredWith(run, 'command.run') || run.studio.bench().shell.settingsOpen,
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
    setup: studio => {
      studio.run('file.open', { path: 'Images/fais moi un bateau.png' })
      studio.run('layer.add', { name: 'Bateau', kind: 'pixel' })
    },
    passed: run => run.studio.bench().selection.ids.length > 0,
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
    name: '46.1 turns the cube into a cylinder',
    said: ['Change le cube en cylindre.'],
    setup: cubeScene,
    passed: run => read.answeredWith(run, 'node.geometry'),
  },
  {
    name: '46.2 puts the boat picture on the billboard',
    said: ['Fais porter au panneau plat mon image du bateau.'],
    setup: spriteScene,
    passed: run => (read.nodeNamed(run, 'Panneau')?.sprite ?? null) !== null,
  },
  {
    name: '46.3 adds a 3D text reading Studio above the cube',
    said: ['Ajoute un texte 3D qui dit Studio au-dessus du cube.'],
    setup: cubeScene,
    passed: run => read.nodes(run).some(one => one.text === 'Studio'),
  },
  {
    name: '46.4 traces a closed path from the cube to the right',
    said: ['Trace un chemin fermé qui part du cube et va vers la droite.'],
    setup: cubeScene,
    passed: run => read.nodesOfKind(run, 'path').length === 1,
  },
  {
    name: '46.5 adds a point two metres further along that path',
    said: ['Ajoute un point à ce chemin, deux mètres plus loin.'],
    setup: pathScene,
    passed: run => (read.nodeNamed(run, 'Chemin')?.points.length ?? 0) >= 1,
  },
  {
    name: '46.6 moves the second point of the path a metre up',
    said: ['Déplace le deuxième point du chemin d’un mètre vers le haut.'],
    setup: studio => {
      pathScene(studio)
      studio.run('path.addPoint', { nodeId: nodeAt(studio, 1), pointX: 0 })
      studio.run('path.addPoint', { nodeId: nodeAt(studio, 1), pointX: 2 })
    },
    passed: run => (read.nodeNamed(run, 'Chemin')?.points[1]?.y ?? 0) !== 0,
  },
  {
    name: '46.7 removes the last point of the path',
    said: ['Supprime le dernier point du chemin.'],
    setup: studio => {
      pathScene(studio)
      studio.run('path.addPoint', { nodeId: nodeAt(studio, 1), pointX: 0 })
      studio.run('path.addPoint', { nodeId: nodeAt(studio, 1), pointX: 2 })
    },
    passed: run => read.nodeNamed(run, 'Chemin')?.points.length === 1,
  },
  {
    name: '46.8 files the sphere under the cube',
    said: ["Range la sphère sous le cube, pour qu'elle le suive quand je le déplace."],
    setup: studio => {
      cubeScene(studio)
      studio.run('node.add', { kind: 'sphere', name: 'Sphere' })
    },
    passed: run => {
      const cube = read.nodeNamed(run, 'Cube Test')
      return cube !== undefined && read.nodeNamed(run, 'Sphere')?.parentId === cube.id
    },
  },

  {
    name: '47.1 cuts a rail for the camera shot',
    said: ['Crée un rail de caméra qui part de la gauche et arrive à droite du cube.'],
    setup: shotScene,
    passed: run => read.answeredWith(run, 'camera.addRail'),
  },
  {
    name: '47.2 makes Camera Test follow that rail',
    said: ['Fais suivre ce rail à Camera Test.'],
    setup: shotScene,
    passed: run =>
      read.answeredWith(run, 'camera.rail') || read.answeredWith(run, 'camera.addRail'),
  },
  {
    name: '47.3 puts Camera Test first in the camera list',
    said: ['Mets Camera Test en premier dans la liste des caméras.'],
    setup: studio => {
      cubeScene(studio)
      studio.run('node.add', { kind: 'camera', name: 'Camera Test' })
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
    passed: run => read.answeredWith(run, 'view.display'),
  },

  {
    name: '47.6 captures the current view into the pictures',
    said: ['Prends une capture de la vue actuelle et range-la dans mes images.'],
    setup: cubeScene,
    passed: run => read.inSpace(run, '3d')[0]?.captures === 1,
  },

  {
    name: '48.1 applies a studio lighting preset to the scene',
    said: ["Applique un préréglage d'éclairage de studio à la scène."],
    setup: cubeScene,
    passed: run => read.answeredWith(run, 'world.preset'),
  },
  {
    name: '48.2 adds a light fog',
    said: ['Ajoute un brouillard léger à la scène.'],
    setup: cubeScene,
    passed: run => read.inSpace(run, '3d')[0]?.world.fog === true,
  },
  {
    name: '48.3 puts a ground under the objects',
    said: ['Ajoute un sol sous mes objets.'],
    setup: cubeScene,
    passed: run => read.inSpace(run, '3d')[0]?.world.ground === true,
  },
  {
    name: '48.4 puts the render at its highest quality',
    said: ['Passe le rendu de la scène en qualité maximale.'],
    setup: cubeScene,
    passed: run => read.answeredWith(run, 'world.render'),
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
    setup: studio => {
      keyedCube(studio)
      studio.run('key.pose', { nodeId: nodeAt(studio, 0), timeSeconds: 9 })
    },
    passed: run => !read.keys(run).some(one => one.at > 5),
  },
  {
    name: '49.3 switches automatic keying on',
    said: ['Active la pose automatique de clés pendant que je travaille.'],
    setup: keyedCube,
    passed: run => read.inSpace(run, '3d')[0]?.autoKey === true,
  },
  {
    name: '49.4 clears the key sitting at 5 seconds',
    said: ['Efface la clé posée à 5 secondes.'],
    setup: keyedCube,
    passed: run => read.keys(run).length === 1 && !read.keys(run).some(one => read.near(one.at, 5)),
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
    passed: run => read.keys(run).some(one => read.near(one.at, 7)),
  },
  {
    name: '49.7 loops the rotation channel of Cube Test',
    said: ['Boucle le canal de rotation de Cube Test.'],
    setup: keyedCube,
    passed: run => read.answeredWith(run, 'channel.flags'),
  },
]
