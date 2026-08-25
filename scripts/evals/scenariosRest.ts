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
    name: '47.5 shows the scene as a wireframe',
    said: ['Affiche la scène en fil de fer.'],
    setup: cubeScene,
    passed: run => read.answeredWith(run, 'view.display'),
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
    name: '49.4 clears the key sitting at 5 seconds',
    said: ['Efface la clé posée à 5 secondes.'],
    setup: keyedCube,
    passed: run => read.keys(run).length === 1 && !read.keys(run).some(one => read.near(one.at, 5)),
  },

  {
    name: '57.1 gives the current 3D settings',
    said: ['Quels sont mes réglages 3D actuels ?'],
    passed: run => idle(run) && read.answeredWith(run, 'settings.read'),
  },
]
