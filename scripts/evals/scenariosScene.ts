import { isRecord } from '@shared/guards'
import type { Run, Scenario } from './run'
import * as read from './oracle'
import {
  blockScene,
  cameraScene,
  cubeScene,
  litScene,
  modelScene,
  nodeAt,
  scene,
  twoSpheres,
  withSphere,
} from './setups'

/**
 * Sections 6 to 14: a 3D scene edited by the sentence — placing, moving relatively, lighting,
 * framing, dressing, importing, texturing and animating.
 *
 * The relative ones (section 7) are the point of the whole batterie: the model has to READ the
 * value that stands before it writes the new one, so each oracle names the arithmetic's answer.
 */

const at = (run: Run, name: string, axis: 'x' | 'y' | 'z', wanted: number): boolean => {
  const node = read.nodeNamed(run, name)
  return node !== undefined && read.near(node.position[axis], wanted, 0.01)
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
    setup: studio => {
      scene()(studio)
      studio.run('node.add', { kind: 'box', name: 'Cube' })
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
    passed: run => read.near(read.nodeNamed(run, 'Cube Test')?.scale.x ?? 0, 2, 0.01),
  },
  {
    name: '6.5 turns it 45 degrees on Y',
    said: ['Fais-le pivoter de 45 degrés sur l’axe Y.'],
    setup: cubeScene,
    passed: run => read.near(read.nodeNamed(run, 'Cube Test')?.rotation.y ?? 0, 45, 0.5),
  },
  {
    name: '6.6 adds a sphere to the right of the cube',
    said: ['Ajoute une sphère à droite du cube.'],
    setup: cubeScene,
    passed: run => (read.nodesOfKind(run, 'sphere')[0]?.position.x ?? 0) > 0,
  },
  {
    name: '6.7 places the sphere exactly 2 metres right of the cube',
    said: ['Place la sphère exactement 2 mètres à droite du cube.'],
    setup: studio => {
      cubeScene(studio)
      studio.run('node.transform', { nodeId: studio.front()?.nodes[0]?.id ?? '', positionX: 1 })
      studio.run('node.add', { kind: 'sphere', name: 'Sphere' })
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
      return spheres.length === 2 && spheres.some(one => one.position.x < 0)
    },
  },
  {
    name: '6.9 renames the two spheres',
    said: ['Renomme les deux sphères Sphere Droite et Sphere Gauche.'],
    setup: studio => {
      cubeScene(studio)
      studio.run('node.add', { kind: 'sphere', name: 'Sphere 1' })
      studio.run('node.add', { kind: 'sphere', name: 'Sphere 2' })
    },
    passed: run =>
      read.nodeNamed(run, 'Sphere Droite') !== undefined &&
      read.nodeNamed(run, 'Sphere Gauche') !== undefined,
  },

  // ——— 7. Manipulation relative ———
  {
    name: '7.1 moves Cube Test one metre up',
    said: ["Déplace Cube Test d'un mètre vers le haut."],
    setup: studio => {
      cubeScene(studio)
      studio.run('node.transform', { nodeId: studio.front()?.nodes[0]?.id ?? '', positionY: 2 })
    },
    passed: run => at(run, 'Cube Test', 'y', 3),
  },
  {
    name: '7.2 moves Sphere Droite 50 cm right',
    said: ['Déplace Sphere Droite de 50 cm vers la droite.'],
    setup: studio => {
      withSphere(studio)
      studio.run('node.transform', { nodeId: studio.front()?.nodes[1]?.id ?? '', positionX: 2 })
    },
    passed: run => at(run, 'Sphere Droite', 'x', 2.5),
  },
  {
    name: '7.3 turns Cube Test 20 degrees further on Y',
    said: ['Fais tourner Cube Test de 20 degrés supplémentaires sur Y.'],
    setup: studio => {
      cubeScene(studio)
      studio.run('node.transform', { nodeId: studio.front()?.nodes[0]?.id ?? '', rotationY: 45 })
    },
    passed: run => read.near(read.nodeNamed(run, 'Cube Test')?.rotation.y ?? 0, 65, 0.5),
  },
  {
    name: '7.4 halves Sphere Gauche',
    said: ['Réduis Sphere Gauche de moitié.'],
    setup: studio => {
      twoSpheres(studio)
      studio.run('node.transform', {
        nodeId: studio.front()?.nodes[2]?.id ?? '',
        scaleX: 2,
        scaleY: 2,
        scaleZ: 2,
      })
    },
    passed: run => read.near(read.nodeNamed(run, 'Sphere Gauche')?.scale.x ?? 0, 1, 0.01),
  },
  {
    name: '7.5 puts Sphere Gauche exactly above Cube Test',
    said: ['Place Sphere Gauche exactement au-dessus de Cube Test.'],
    setup: studio => {
      twoSpheres(studio)
      studio.run('node.transform', {
        nodeId: studio.front()?.nodes[0]?.id ?? '',
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
        read.near(sphere.position.x, cube.position.x, 0.01) &&
        read.near(sphere.position.z, cube.position.z, 0.01) &&
        sphere.position.y > cube.position.y
      )
    },
  },

  // ——— 8. Lumières ———
  {
    name: '8.1 adds a directional light',
    said: ['Ajoute une lumière directionnelle à la scène.'],
    setup: cubeScene,
    passed: run => read.nodesOfKind(run, 'directional').length === 1,
  },
  {
    name: '8.2 renames it Soleil Test',
    said: ['Renomme-la Soleil Test.'],
    setup: studio => {
      cubeScene(studio)
      studio.run('node.add', { kind: 'directional', name: 'Lumière' })
    },
    passed: run => read.nodeNamed(run, 'Soleil Test')?.kind === 'directional',
  },
  {
    name: '8.3 raises its intensity by 25 percent',
    said: ['Augmente son intensité de 25 %.'],
    setup: studio => {
      litScene(studio)
      studio.run('node.light', { nodeId: studio.front()?.nodes[1]?.id ?? '', intensity: 2 })
    },
    passed: run => read.near(read.nodeNamed(run, 'Soleil Test')?.intensity ?? 0, 2.5, 0.01),
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
    setup: studio => {
      cubeScene(studio)
      studio.run('node.add', { kind: 'point', name: 'Ponctuelle' })
      studio.run('node.light', { nodeId: studio.front()?.nodes[1]?.id ?? '', intensity: 4 })
    },
    passed: run => read.near(read.nodeNamed(run, 'Ponctuelle')?.intensity ?? 0, 2, 0.01),
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
    setup: studio => {
      litScene(studio)
      studio.run('node.visible', { nodeId: studio.front()?.nodes[1]?.id ?? '', visible: false })
    },
    passed: run => read.nodeNamed(run, 'Soleil Test')?.visible === true,
  },

  // ——— 9. Caméras ———
  {
    name: '9.1 adds a camera called Camera Test',
    said: ['Ajoute une nouvelle caméra appelée Camera Test.'],
    setup: cubeScene,
    passed: run => read.nodeNamed(run, 'Camera Test')?.kind === 'camera',
  },
  {
    name: '9.2 places Camera Test facing the cube',
    said: ['Place Camera Test face au cube.'],
    setup: cameraScene,
    passed: run => {
      const camera = read.nodeNamed(run, 'Camera Test')
      return camera !== undefined && (camera.position.z !== 0 || camera.position.x !== 0)
    },
  },
  {
    name: '9.3 aims Camera Test at Cube Test',
    said: ["Oriente Camera Test pour qu'elle regarde Cube Test."],
    setup: cameraScene,
    // A target is set on a SHOT, so the plan is `camera.shot` then `camera.target` — the model
    // has to find that out, which is the whole of what this scenario measures.
    passed: run => {
      const camera = read.nodeNamed(run, 'Camera Test')
      const cube = read.nodeNamed(run, 'Cube Test')
      return cube !== undefined && camera?.targetId === cube.id
    },
  },
  {
    name: '9.4 pulls Camera Test back two metres without losing its target',
    said: ["Éloigne Camera Test de 2 mètres sans changer la cible qu'elle regarde."],
    setup: studio => {
      cameraScene(studio)
      const camera = nodeAt(studio, 1)
      studio.run('node.transform', { nodeId: camera, positionZ: 5 })
      const shot = studio.run('camera.shot', { nodeId: camera })
      studio.run('camera.target', {
        shotId: shot.ok && isRecord(shot.data) ? String(shot.data['shotId']) : '',
        targetId: nodeAt(studio, 0),
      })
    },
    passed: run => {
      const camera = read.nodeNamed(run, 'Camera Test')
      return (
        camera !== undefined && read.near(camera.position.z, 7, 0.01) && camera.targetId !== null
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
    passed: run => read.inSpace(run, '3d')[0]?.world.environment !== null,
  },
  {
    name: '10.3 lowers the environment intensity to 0.7',
    said: ["Réduis l'intensité de l'environnement à 0,7."],
    setup: cubeScene,
    passed: run =>
      read.near(read.inSpace(run, '3d')[0]?.world.environmentIntensity ?? 0, 0.7, 0.01),
  },
  {
    name: '10.4 turns the shadows on',
    said: ['Active les ombres.'],
    setup: cubeScene,
    // Per node (`node.shadow`) or on the ground, and as a three setting — never a world switch.
    passed: run =>
      read.wrote(run, 'three', 'shadow') ||
      read.answeredWith(run, 'node.shadow') ||
      read.inSpace(run, '3d')[0]?.world.shadows === true,
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
    setup: studio => {
      cubeScene(studio)
      studio.run('world.environment', { kind: 'skybox', assetId: 'asset-1', intensity: 1 })
    },
    passed: run => {
      const world = read.inSpace(run, '3d')[0]?.world
      return world?.background !== null && world?.environment === 'asset-1'
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
    setup: studio => {
      modelScene(studio)
      studio.run('node.transform', { nodeId: studio.front()?.nodes[0]?.id ?? '', positionX: 4 })
    },
    passed: run => at(run, 'Knight', 'x', 0),
  },
  {
    name: '11.3 scales it so it reads properly',
    said: ['Adapte automatiquement sa taille pour qu’il soit visible correctement.'],
    setup: modelScene,
    passed: run => (read.nodeNamed(run, 'Knight')?.scale.x ?? 1) !== 1,
  },
  {
    name: '11.4 frames that model with Camera Test',
    said: ['Place Camera Test pour cadrer entièrement ce modèle.'],
    setup: studio => {
      modelScene(studio)
      studio.run('node.add', { kind: 'camera', name: 'Camera Test' })
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
    passed: run => read.nodeNamed(run, 'Bloc')?.color !== null,
  },
  {
    name: '12.3 puts its roughness at 0.25',
    said: ['Mets sa rugosité à 0,25.'],
    setup: blockScene,
    passed: run => read.answeredWith(run, 'node.material'),
  },
  {
    name: '12.4 puts its metalness at 0.8',
    said: ['Mets son métal à 0,8.'],
    setup: blockScene,
    passed: run => read.answeredWith(run, 'node.material'),
  },
  {
    name: '12.5 assigns a project texture to its base colour',
    said: ['Assigne une texture de mon projet à sa couleur de base.'],
    setup: blockScene,
    passed: run => read.nodeNamed(run, 'Bloc')?.textures.map !== undefined,
  },
  {
    name: '12.6 adds a normal map if a compatible texture exists',
    said: ['Ajoute une normal map si une texture compatible existe dans le projet.'],
    setup: blockScene,
    passed: run => read.nodeNamed(run, 'Bloc')?.textures.normalMap !== undefined,
  },
  {
    name: '12.7 puts the material back as it was',
    said: ['Remets le matériau dans son état précédent.'],
    setup: studio => {
      blockScene(studio)
      studio.run('node.material', { nodeId: studio.front()?.nodes[0]?.id ?? '', color: '#ff0000' })
    },
    passed: run => read.spoke(run),
  },

  // ——— 13. Timeline 3D ———
  {
    name: '13.1 sets the scene duration to 10 seconds',
    said: ['Mets la durée de la scène à 10 secondes.'],
    setup: cubeScene,
    passed: run => read.near(read.inSpace(run, '3d')[0]?.duration ?? 0, 10, 0.01),
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
      const at = (when: number) => read.keys(run).find(one => read.near(one.at, when))
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
    setup: studio => {
      cubeScene(studio)
      studio.run('key.pose', { nodeId: studio.front()?.nodes[0]?.id ?? '', timeSeconds: 0 })
    },
    passed: run => {
      const back = read.keys(run).find(one => read.near(one.at, 10))
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
    passed: run => read.keys(run).some(one => read.near(one.at, 2)),
  },
  {
    name: '13.6 removes only the rotation animation of the cube',
    said: [
      "Supprime uniquement l'animation de rotation du cube sans supprimer son animation de position.",
    ],
    // The decor has to hold BOTH, or « uniquement la rotation » sorts nothing and doing
    // nothing passes.
    setup: studio => {
      cubeScene(studio)
      const cube = nodeAt(studio, 0)
      studio.run('key.pose', { nodeId: cube, timeSeconds: 0, property: 'position' })
      studio.run('node.transform', { nodeId: cube, positionY: 5 })
      studio.run('key.pose', { nodeId: cube, timeSeconds: 5, property: 'position' })
      studio.run('node.transform', { nodeId: cube, rotationY: 360 })
      studio.run('key.pose', { nodeId: cube, timeSeconds: 5, property: 'rotation' })
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
    passed: run => read.keys(run).some(one => read.near(one.at, 5)),
  },
  {
    name: '14.2 keeps the camera aimed at Cube Test while it moves',
    said: ['Pendant son déplacement, garde la caméra orientée vers Cube Test.'],
    setup: cameraScene,
    passed: run => (read.nodeNamed(run, 'Camera Test')?.targetId ?? null) !== null,
  },
  {
    name: '14.3 orbits the camera round the cube between 5 and 10 seconds',
    said: ['Entre 5 et 10 secondes, fais tourner la caméra autour du cube.'],
    setup: cameraScene,
    passed: run => read.keys(run).some(one => one.at >= 5),
  },
  {
    name: '14.4 checks the camera never loses Cube Test from view',
    said: ["Vérifie qu'à aucun moment la caméra ne perd Cube Test de vue."],
    setup: studio => {
      cameraScene(studio)
      const camera = studio.front()?.nodes[1]?.id ?? ''
      studio.run('camera.shot', { nodeId: camera })
    },
    passed: run => read.spoke(run) && read.answeredWith(run, 'scene.state'),
  },
]
