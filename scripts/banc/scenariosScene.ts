import { isRecord } from '@shared/guards'
import type { Run, Scenario } from './run'
import * as read from './oracle'
import {
  blockScene,
  cameraScene,
  cubeScene,
  litScene,
  modelScene,
  named,
  scene,
  twoSpheres,
  wallAndCube,
  withSphere,
} from './setups'

/**
 * Sections 6 to 14: a 3D scene edited by the sentence. The relative ones (section 7) are the
 * point of the whole batterie — the model has to READ a value before it writes the new one.
 */

const at = (run: Run, name: string, axis: 'x' | 'y' | 'z', wanted: number): boolean => {
  const node = read.nodeNamed(run, name)
  return node !== undefined && read.near(node.transform.position[axis], wanted, 0.01)
}

export const SCENE_SCENARIOS: readonly Scenario[] = [
  // ——— 6. Manipulation simple d'une scène 3D ———
  {
    name: '6.1 adds a cube at the centre',
    said: ['Ajoute un cube au centre de la scène.'],
    setup: scene(),
    passed: run => read.nodesOfKind(run, 'box').length === 1,
  },
  {
    name: '6.2 renames the cube Cube Test',
    said: ['Renomme le cube Cube Test.'],
    setup: async studio => {
      await scene()(studio)
      await studio.run('node.add', { kind: 'box', name: 'Cube' })
    },
    passed: run => read.nodeNamed(run, 'Cube Test') !== undefined,
  },
  {
    name: '6.3 places Cube Test at X 2, Y 1, Z -3',
    said: ['Place Cube Test à X 2, Y 1, Z -3.'],
    setup: cubeScene,
    passed: run =>
      at(run, 'Cube Test', 'x', 2) && at(run, 'Cube Test', 'y', 1) && at(run, 'Cube Test', 'z', -3),
  },
  {
    name: '6.4 doubles its size',
    said: ['Double sa taille.'],
    setup: cubeScene,
    passed: run => read.near(read.nodeNamed(run, 'Cube Test')?.transform.scale.x ?? 0, 2, 0.01),
  },
  {
    name: '6.5 turns it 45 degrees on Y',
    said: ['Fais-le pivoter de 45 degrés sur l’axe Y.'],
    setup: cubeScene,
    passed: run =>
      read.near(
        read.nodeNamed(run, 'Cube Test')?.transform.rotation.y ?? 0,
        read.radians(45),
        0.01,
      ),
  },
  {
    name: '6.6 adds a sphere to the right of the cube',
    said: ['Ajoute une sphère à droite du cube.'],
    setup: cubeScene,
    passed: run => (read.nodesOfKind(run, 'sphere')[0]?.transform.position.x ?? 0) > 0,
  },
  {
    name: '6.7 places the sphere exactly 2 metres right of the cube',
    said: ['Place la sphère exactement 2 mètres à droite du cube.'],
    setup: async studio => {
      await cubeScene(studio)
      await studio.run('node.transform', { nodeId: named(studio, 'Cube Test'), positionX: 1 })
      await studio.run('node.add', { kind: 'sphere', name: 'Sphere' })
    },
    // The cube stands at X = 1, so « exactly two metres right » is X = 3 and nothing else.
    passed: run => at(run, 'Sphere', 'x', 3),
  },
  {
    name: '6.8 duplicates the sphere and puts the copy left of the cube',
    said: ['Duplique la sphère et place la copie à gauche du cube.'],
    setup: withSphere,
    passed: run => {
      const spheres = read.nodesOfKind(run, 'sphere')
      return spheres.length === 2 && spheres.some(one => one.transform.position.x < 0)
    },
  },
  {
    name: '6.9 renames the two spheres',
    said: ['Renomme les deux sphères Sphere Droite et Sphere Gauche.'],
    setup: async studio => {
      await cubeScene(studio)
      await studio.run('node.add', { kind: 'sphere', name: 'Sphere 1' })
      await studio.run('node.add', { kind: 'sphere', name: 'Sphere 2' })
    },
    passed: run =>
      read.nodeNamed(run, 'Sphere Droite') !== undefined &&
      read.nodeNamed(run, 'Sphere Gauche') !== undefined,
  },
  {
    name: '6.10 cuts a window in the wall with the cube',
    said: ['Perce une fenêtre dans le mur avec le cube.'],
    setup: wallAndCube,
    passed: run => read.carvedBy(run, 'subtract'),
  },
  {
    name: '6.11 joins the wall and the cube into one shape',
    said: ['Fusionne le mur et le cube en une seule forme.'],
    setup: wallAndCube,
    passed: run => read.carvedBy(run, 'unite'),
  },
  {
    name: '6.12 keeps only what the wall and the cube share',
    said: ['Ne garde que la partie où le mur et le cube se chevauchent.'],
    setup: wallAndCube,
    passed: run => read.carvedBy(run, 'intersect'),
  },
  {
    // The shapes come back BY NAME, which is what tells a separate from a plain delete: the
    // graph kept them, so the wall and the cube are the very two that went in.
    name: '6.13 separates the solid and gives the shapes back',
    said: ["Sépare ce solide et rends-moi les formes d'origine."],
    setup: async studio => {
      await wallAndCube(studio)
      await studio.run('node.carve', {
        nodeIds: [named(studio, 'Mur'), named(studio, 'Cube')],
        operation: 'subtract',
      })
    },
    passed: run =>
      read.nodesOfKind(run, 'carved').length === 0 &&
      read.nodeNamed(run, 'Mur') !== undefined &&
      read.nodeNamed(run, 'Cube') !== undefined,
  },
  {
    /**
     * Roblox's gesture, and the whole of why the mark exists: a UNION holding a marked shape is a
     * PIERCING. Scored on the verb the SOLID carries, which no fusion could leave behind unless
     * the mark reached the document first.
     */
    name: '6.14 marks the cube as a tool, so joining it pierces the wall',
    said: ['Marque le cube comme outil, puis fusionne-le avec le mur.'],
    setup: wallAndCube,
    passed: run => read.carvedBy(run, 'subtract'),
  },
  {
    name: '6.15 takes the tool mark off the cube',
    said: ["Retire au cube sa marque d'outil."],
    setup: async studio => {
      await wallAndCube(studio)
      await studio.run('node.negate', { nodeIds: [named(studio, 'Cube')] })
    },
    passed: run => read.isNegative(read.nodeNamed(run, 'Cube')) === false,
  },
  {
    /**
     * The repair, in one call: the solid keeps the CUBE's name where the wall's was, which is
     * what says the roles swapped rather than the fold merely being undone.
     */
    name: '6.16 folds a solid the other way round',
    said: ["Ce pli est parti à l'envers, refais-le dans l'autre sens."],
    setup: async studio => {
      await wallAndCube(studio)
      await studio.run('node.carve', {
        nodeIds: [named(studio, 'Mur'), named(studio, 'Cube')],
        operation: 'subtract',
      })
    },
    passed: run =>
      read.carvedBy(run, 'subtract') && read.nodesOfKind(run, 'carved')[0]?.name === 'Cube',
  },

  // ——— 7. Manipulation relative ———
  {
    name: '7.1 moves Cube Test one metre up',
    said: ["Déplace Cube Test d'un mètre vers le haut."],
    setup: async studio => {
      await cubeScene(studio)
      await studio.run('node.transform', { nodeId: named(studio, 'Cube Test'), positionY: 2 })
    },
    passed: run => at(run, 'Cube Test', 'y', 3),
  },
  {
    name: '7.2 moves Sphere Droite 50 cm right',
    said: ['Déplace Sphere Droite de 50 cm vers la droite.'],
    setup: async studio => {
      await withSphere(studio)
      await studio.run('node.transform', { nodeId: named(studio, 'Sphere Droite'), positionX: 2 })
    },
    passed: run => at(run, 'Sphere Droite', 'x', 2.5),
  },
  {
    name: '7.3 turns Cube Test 20 degrees further on Y',
    said: ['Fais tourner Cube Test de 20 degrés supplémentaires sur Y.'],
    setup: async studio => {
      await cubeScene(studio)
      await studio.run('node.transform', {
        nodeId: named(studio, 'Cube Test'),
        rotationY: read.radians(45),
      })
    },
    passed: run =>
      read.near(
        read.nodeNamed(run, 'Cube Test')?.transform.rotation.y ?? 0,
        read.radians(65),
        0.01,
      ),
  },
  {
    name: '7.4 halves Sphere Gauche',
    said: ['Réduis Sphere Gauche de moitié.'],
    setup: async studio => {
      await twoSpheres(studio)
      await studio.run('node.transform', {
        nodeId: named(studio, 'Sphere Gauche'),
        scaleX: 2,
        scaleY: 2,
        scaleZ: 2,
      })
    },
    passed: run => read.near(read.nodeNamed(run, 'Sphere Gauche')?.transform.scale.x ?? 0, 1, 0.01),
  },
  {
    name: '7.5 puts Sphere Gauche exactly above Cube Test',
    said: ['Place Sphere Gauche exactement au-dessus de Cube Test.'],
    setup: async studio => {
      await twoSpheres(studio)
      await studio.run('node.transform', {
        nodeId: named(studio, 'Cube Test'),
        positionX: 2,
        positionZ: -1,
      })
    },
    // Above means the cube's own X and Z, and a Y above it — anything else is not « exactly ».
    passed: run => {
      const sphere = read.nodeNamed(run, 'Sphere Gauche')
      const cube = read.nodeNamed(run, 'Cube Test')
      return (
        sphere !== undefined &&
        cube !== undefined &&
        read.near(sphere.transform.position.x, cube.transform.position.x, 0.01) &&
        read.near(sphere.transform.position.z, cube.transform.position.z, 0.01) &&
        sphere.transform.position.y > cube.transform.position.y
      )
    },
  },

  // ——— 8. Lumières ———
  {
    name: '8.1 adds a directional light',
    said: ['Ajoute une lumière directionnelle à la scène.'],
    setup: cubeScene,
    // TWO: a new scene is lit — ambient, directional and hemisphere — so « ajoute-en une » adds
    // to what is already there rather than making the first.
    passed: run => read.nodesOfKind(run, 'directional').length === 2,
  },
  {
    name: '8.2 renames it Soleil Test',
    said: ['Renomme-la Soleil Test.'],
    setup: async studio => {
      await cubeScene(studio)
      await studio.run('node.add', { kind: 'directional', name: 'Lumière' })
    },
    passed: run => read.kindNamed(run, 'Soleil Test') === 'directional',
  },
  {
    name: '8.3 raises its intensity by 25 percent',
    said: ['Augmente son intensité de 25 %.'],
    setup: async studio => {
      await litScene(studio)
      await studio.run('node.light', { nodeId: named(studio, 'Soleil Test'), intensity: 2 })
    },
    passed: run =>
      read.near(read.lightOf(read.nodeNamed(run, 'Soleil Test'))?.intensity ?? 0, 2.5, 0.01),
  },
  {
    name: '8.4 adds a point light above the cube',
    said: ['Ajoute une lumière ponctuelle au-dessus du cube.'],
    setup: litScene,
    passed: run => read.nodesOfKind(run, 'point').length === 1,
  },
  {
    name: '8.5 halves its intensity',
    said: ['Réduis son intensité de moitié.'],
    setup: async studio => {
      await cubeScene(studio)
      await studio.run('node.add', { kind: 'point', name: 'Ponctuelle' })
      await studio.run('node.light', { nodeId: named(studio, 'Ponctuelle'), intensity: 4 })
    },
    passed: run =>
      read.near(read.lightOf(read.nodeNamed(run, 'Ponctuelle'))?.intensity ?? 0, 2, 0.01),
  },
  {
    name: '8.6 switches Soleil Test off',
    said: ['Désactive Soleil Test.'],
    setup: litScene,
    passed: run => read.nodeNamed(run, 'Soleil Test')?.visible === false,
  },
  {
    name: '8.7 switches Soleil Test back on',
    said: ['Réactive Soleil Test.'],
    setup: async studio => {
      await litScene(studio)
      await studio.run('node.visible', { nodeId: named(studio, 'Soleil Test'), visible: false })
    },
    passed: run => read.nodeNamed(run, 'Soleil Test')?.visible === true,
  },

  // ——— 9. Caméras ———
  {
    name: '9.1 adds a camera called Camera Test',
    said: ['Ajoute une nouvelle caméra appelée Camera Test.'],
    setup: cubeScene,
    passed: run => read.kindNamed(run, 'Camera Test') === 'camera',
  },
  {
    name: '9.2 places Camera Test facing the cube',
    said: ['Place Camera Test face au cube.'],
    setup: cameraScene,
    passed: run => read.moved(run, 'Camera Test'),
  },
  {
    name: '9.3 aims Camera Test at Cube Test',
    said: ["Oriente Camera Test pour qu'elle regarde Cube Test."],
    setup: cameraScene,
    // A target is set on a SHOT, so the plan is `camera.shot` then `camera.target` — the model
    // has to find that out, which is the whole of what this scenario measures.
    passed: run => {
      const cube = read.nodeNamed(run, 'Cube Test')
      return cube !== undefined && read.aimsAt(run, cube.id)
    },
  },
  {
    name: '9.4 pulls Camera Test back two metres without losing its target',
    said: ["Éloigne Camera Test de 2 mètres sans changer la cible qu'elle regarde."],
    setup: async studio => {
      await cameraScene(studio)
      const camera = named(studio, 'Camera Test')
      await studio.run('node.transform', { nodeId: camera, positionZ: 5 })
      const shot = await studio.run('camera.shot', { nodeId: camera })
      await studio.run('camera.target', {
        shotId: shot.ok && isRecord(shot.data) ? String(shot.data['shotId']) : '',
        targetId: named(studio, 'Cube Test'),
      })
    },
    passed: run => {
      const camera = read.nodeNamed(run, 'Camera Test')
      return (
        camera !== undefined && read.near(camera.transform.position.z, 7, 0.01) && read.aimsAt(run)
      )
    },
  },
  {
    name: '9.5 makes Camera Test the active camera',
    said: ['Fais de Camera Test la caméra active.'],
    setup: cameraScene,
    // The camera stands there already: what is measured is the call that arms it, not its being.
    passed: run => read.answeredWith(run, 'node.camera') || read.answeredWith(run, 'camera.shot'),
  },
  {
    name: '9.6 gives its position and rotation back',
    said: ['Donne-moi maintenant sa position et sa rotation.'],
    setup: cameraScene,
    passed: run => read.spoke(run) && read.answeredWith(run, 'scene.state'),
  },

  // ——— 10. Environnement 3D ———
  {
    name: '10.1 turns the scene grid on',
    said: ['Active la grille de la scène.'],
    setup: cubeScene,
    // No action of its own: the grid is a three setting, so `settings.write` is the road.
    passed: run => read.wrote(run, 'three', 'grid'),
  },
  {
    name: '10.2 uses the first skybox as the environment',
    said: ['Change l’environnement pour utiliser ma première skybox.'],
    setup: cubeScene,
    passed: run => read.world(run)?.environment.kind === 'skybox',
  },
  {
    name: '10.3 lowers the environment intensity to 0.7',
    said: ["Réduis l'intensité de l'environnement à 0,7."],
    setup: cubeScene,
    passed: run => read.near(read.world(run)?.envIntensity ?? 0, 0.7, 0.01),
  },
  {
    name: '10.4 turns the shadows on',
    said: ['Active les ombres.'],
    setup: cubeScene,
    // Per node (`node.shadow`) or on the ground, and as a three setting — never a world switch.
    // Not `castShadow`: a fresh mesh and a fresh sun both throw one already.
    passed: run => read.wrote(run, 'three', 'shadow') || read.answeredWith(run, 'node.shadow'),
  },
  {
    name: '10.5 puts the shadow quality at its highest',
    said: ['Mets la qualité des ombres au niveau le plus élevé disponible.'],
    setup: cubeScene,
    passed: run => read.wrote(run, 'three', 'shadow'),
  },
  {
    name: '10.6 changes the backdrop without touching the lighting',
    said: ["Change l'arrière-plan sans changer l'éclairage de la scène."],
    setup: async studio => {
      await cubeScene(studio)
      await studio.run('world.environment', { kind: 'skybox', assetId: 'asset-1', intensity: 1 })
    },
    passed: run => {
      const world = read.world(run)
      // The backdrop is CHOSEN — a colour or nothing at all, rather than the environment a new
      // scene draws — and the lighting is the one the decor armed, untouched.
      return (
        world !== null &&
        world.background.kind !== 'environment' &&
        world.environment.kind === 'skybox' &&
        world.environment.assetId === 'asset-1'
      )
    },
  },

  // ——— 11. Import d'assets dans une scène ———
  {
    name: '11.1 adds the first 3D model to Test MCP',
    said: ['Ajoute mon premier modèle 3D dans Test MCP.'],
    setup: scene(),
    passed: run => read.nodesOfKind(run, 'model').length === 1,
  },
  {
    name: '11.2 places it at the centre',
    said: ['Place-le au centre de la scène.'],
    setup: async studio => {
      await modelScene(studio)
      await studio.run('node.transform', { nodeId: named(studio, 'Knight'), positionX: 4 })
    },
    passed: run => at(run, 'Knight', 'x', 0),
  },
  {
    name: '11.3 scales it so it reads properly',
    said: ['Adapte automatiquement sa taille pour qu’il soit visible correctement.'],
    setup: modelScene,
    passed: run => (read.nodeNamed(run, 'Knight')?.transform.scale.x ?? 1) !== 1,
  },
  {
    name: '11.4 frames that model with Camera Test',
    said: ['Place Camera Test pour cadrer entièrement ce modèle.'],
    setup: async studio => {
      await modelScene(studio)
      await studio.run('node.add', { kind: 'camera', name: 'Camera Test' })
    },
    passed: run => read.framing(run, 'Camera Test'),
  },
  {
    name: '11.5 adds a second instance of the same model to its right',
    said: ['Ajoute une deuxième instance du même modèle à sa droite.'],
    setup: modelScene,
    passed: run => read.nodesOfKind(run, 'model').length === 2,
  },

  // ——— 12. Textures et matériaux ———
  {
    name: '12.1 selects the model just added and names its materials',
    said: ['Sélectionne le modèle 3D que nous venons d’ajouter et donne-moi ses matériaux.'],
    setup: modelScene,
    passed: run => read.spoke(run),
  },
  {
    name: '12.2 turns its first material red',
    said: ['Change la couleur de base de son premier matériau en rouge.'],
    setup: blockScene,
    passed: run => read.nodeMaterialOf(read.nodeNamed(run, 'Bloc'))?.color !== null,
  },
  {
    name: '12.3 puts its roughness at 0.25',
    said: ['Mets sa rugosité à 0,25.'],
    setup: blockScene,
    passed: run =>
      read.near(read.nodeMaterialOf(read.nodeNamed(run, 'Bloc'))?.roughness ?? 1, 0.25),
  },
  {
    name: '12.4 puts its metalness at 0.8',
    said: ['Mets son métal à 0,8.'],
    setup: blockScene,
    passed: run => read.near(read.nodeMaterialOf(read.nodeNamed(run, 'Bloc'))?.metalness ?? 0, 0.8),
  },
  {
    name: '12.5 assigns a project texture to its base colour',
    said: ['Assigne une texture de mon projet à sa couleur de base.'],
    setup: blockScene,
    passed: run => read.nodeMaterialOf(read.nodeNamed(run, 'Bloc'))?.map != null,
  },
  {
    name: '12.6 adds a normal map if a compatible texture exists',
    said: ['Ajoute une normal map si une texture compatible existe dans le projet.'],
    setup: blockScene,
    passed: run => read.nodeMaterialOf(read.nodeNamed(run, 'Bloc'))?.normalMap != null,
  },
  {
    name: '12.7 puts the material back as it was',
    said: ['Remets le matériau dans son état précédent.'],
    setup: async studio => {
      await blockScene(studio)
      await studio.run('node.material', { nodeId: named(studio, 'Bloc'), color: '#ff0000' })
    },
    passed: run => read.spoke(run),
  },
  {
    /**
     * An imported model, NOT a primitive: its finish rides on `model.material` rather than on
     * `node.material` — a `.glb` carries its own per material, and what the studio puts over it
     * is the eight dials a plain standard material reads.
     */
    name: '12.8 makes an imported model matter',
    said: ['Rends ce modèle importé plus mat, sa rugosité à 0,8.'],
    setup: modelScene,
    passed: run => read.near(read.modelFinish(run, 'Knight')?.roughness ?? 0, 0.8, 0.01),
  },

  // ——— 13. Timeline 3D ———
  {
    name: '13.1 sets the scene duration to 10 seconds',
    said: ['Mets la durée de la scène à 10 secondes.'],
    setup: cubeScene,
    passed: run => read.lasts(read.sceneLasts(run), 10),
  },
  {
    name: '13.2 animates Cube Test five metres up between 0 and 5 seconds',
    said: [
      'Anime Cube Test pour qu’il parte de sa position actuelle à 0 seconde et arrive 5 mètres plus haut à 5 secondes.',
    ],
    setup: cubeScene,
    // A key holds the pose the node WEARS, so two keys at the same height are an animation of
    // nothing: the second one has to sit five metres above the first.
    passed: run => {
      const at = (when: number) => read.keys(run).find(one => read.near(one.time, when))
      const start = at(0)
      const end = at(5)
      return (
        start !== undefined && end !== undefined && read.near(end.value.y - start.value.y, 5, 0.01)
      )
    },
  },
  {
    name: '13.3 brings it back to its first position at 10 seconds',
    said: ['À 10 secondes, fais-le revenir à sa position initiale.'],
    setup: async studio => {
      await cubeScene(studio)
      await studio.run('key.pose', { nodeId: named(studio, 'Cube Test'), timeSeconds: 0 })
    },
    passed: run => {
      const back = read.keys(run).find(one => read.near(one.time, 10))
      return back !== undefined && read.near(back.value.y, 0, 0.01)
    },
  },
  {
    name: '13.4 adds a full turn of the cube between 0 and 10 seconds',
    said: ['Ajoute une rotation complète du cube entre 0 et 10 secondes.'],
    setup: cubeScene,
    passed: run => read.keys(run).some(one => one.channel.endsWith('rotation')),
  },
  {
    name: '13.5 starts the Sphere Droite animation at 2 seconds',
    said: ["Fais commencer l'animation de Sphere Droite à 2 secondes."],
    setup: withSphere,
    passed: run => read.keys(run).some(one => read.near(one.time, 2)),
  },
  {
    name: '13.6 removes only the rotation animation of the cube',
    said: [
      "Supprime uniquement l'animation de rotation du cube sans supprimer son animation de position.",
    ],
    // The decor has to hold BOTH, or « uniquement la rotation » sorts nothing and doing
    // nothing passes.
    setup: async studio => {
      await cubeScene(studio)
      const cube = named(studio, 'Cube Test')
      await studio.run('key.pose', { nodeId: cube, timeSeconds: 0, property: 'position' })
      await studio.run('node.transform', { nodeId: cube, positionY: 5 })
      await studio.run('key.pose', { nodeId: cube, timeSeconds: 5, property: 'position' })
      await studio.run('node.transform', { nodeId: cube, rotationY: read.radians(360) })
      await studio.run('key.pose', { nodeId: cube, timeSeconds: 5, property: 'rotation' })
    },
    passed: run =>
      read.keys(run).some(one => one.channel.endsWith('position')) &&
      !read.keys(run).some(one => one.channel.endsWith('rotation')),
  },

  // ——— 14. Animation de caméra ———
  {
    name: '14.1 moves Camera Test towards the cube between 0 and 5 seconds',
    said: [
      'Anime Camera Test pour qu’elle se rapproche progressivement du cube entre 0 et 5 secondes.',
    ],
    setup: cameraScene,
    passed: run => read.keys(run).some(one => read.lasts(one.time, 5)),
  },
  {
    name: '14.2 keeps the camera aimed at Cube Test while it moves',
    said: ['Pendant son déplacement, garde la caméra orientée vers Cube Test.'],
    setup: cameraScene,
    passed: run => read.aimsAt(run),
  },
  {
    name: '14.3 orbits the camera round the cube between 5 and 10 seconds',
    said: ['Entre 5 et 10 secondes, fais tourner la caméra autour du cube.'],
    setup: cameraScene,
    passed: run => read.keys(run).some(one => one.time >= 5 * read.SECOND),
  },
  {
    name: '14.4 checks the camera never loses Cube Test from view',
    said: ["Vérifie qu'à aucun moment la caméra ne perd Cube Test de vue."],
    setup: async studio => {
      await cameraScene(studio)
      const camera = named(studio, 'Camera Test')
      await studio.run('camera.shot', { nodeId: camera })
    },
    passed: run => read.spoke(run) && read.answeredWith(run, 'scene.state'),
  },
]
