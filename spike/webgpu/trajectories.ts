import type { CameraPlacement } from '@/engines/scene/sceneView'

/**
 * Les trajectoires du banc, DÉCLARÉES plutôt que codées dans chaque scénario.
 *
 * Deux stratégies doivent pouvoir rejouer exactement la même chose : la pose d'une frame est donc
 * une fonction PURE de son rang, sans état, sans horloge et sans `Math.random`. Le `seed` voyage
 * avec la trajectoire pour que le monde qu'elle parcourt soit nommé par le même objet.
 */

export type Pose = CameraPlacement

export type Trajectory = {
  name: string
  /** La graine du MONDE que cette trajectoire parcourt : une pose n'a de sens que sur son décor. */
  seed: number
  frames: number
  /** La pose au rang `at`. Pure : deux appels de même rang rendent la même chose. */
  poseAt: (at: number) => Pose
  /**
   * Où la caméra se tient AVANT la séquence mesurée, et combien de frames elle y reste.
   *
   * Sans cela une téléportation ne s'exprime pas : une fonction pure du rang ne connaît pas
   * d'avant, et poser le point d'arrivée à toutes les frames ne saute nulle part.
   */
  warmFrom?: { pose: Pose; frames: number }
}

/** Hauteur d'yeux d'une caméra posée au sol. */
const EYES = 1.7

const looking = (x: number, z: number, y: number, heading: number, pitch = 0): Pose => ({
  position: { x, y, z },
  target: {
    x: x + Math.cos(heading) * Math.cos(pitch),
    y: y + Math.sin(pitch),
    z: z + Math.sin(heading) * Math.cos(pitch),
  },
})

/** Ce qu'il faut savoir du monde pour y tracer une trajectoire : sa taille et la zone active. */
export type Ground = { span: number; far: number; seed: number; boundaryAt: number }

/**
 * Les sept scénarios. `boundary` reçoit son abscisse du banc, qui la MESURE plutôt que de la
 * deviner : une frontière de région dépend de la grille que `regionsByGrid` a posée sur les
 * centres, et aucune constante ne la connaît.
 */
export function trajectoriesFor({ span, far, seed, boundaryAt }: Ground): Trajectory[] {
  const start = -span * 0.6
  return [
    { name: 'rest', seed, frames: 240, poseAt: () => looking(start, 0, EYES, 0) },
    // 0,05 m/frame : la vitesse d'un éditeur, celle où un corps traîne autour d'un seuil.
    { name: 'walk', seed, frames: 300, poseAt: at => looking(start + at * 0.05, 0, EYES, 0) },
    // 1 m/frame, soit 120 m/s à 120 Hz : le pire cas assumé, repris de C3.
    { name: 'run', seed, frames: 300, poseAt: at => looking(-span * 0.9 + at * 1, 0, EYES, 0) },
    {
      name: 'spin',
      seed,
      frames: 180,
      poseAt: at => looking(0, 0, EYES, (at / 180) * Math.PI * 2),
    },
    // Lente et CENTRÉE sur la frontière mesurée : un pic de traversée se noie dans une course.
    {
      name: 'boundary',
      seed,
      frames: 200,
      poseAt: at => looking(boundaryAt - 20 + at * 0.2, 0, EYES, 0),
    },
    // Le saut, puis la stabilisation : le coût exceptionnel se lit sur les frames qui suivent.
    {
      name: 'teleport',
      seed,
      frames: 180,
      poseAt: () => looking(span * 0.9, 0, EYES, 0),
      warmFrom: { pose: looking(-span * 0.9, 0, EYES, 0), frames: 60 },
    },
    // Pire cas de FRUSTUM, pas de mouvement : beaucoup de zone visible d'un coup. Posée par
    // rapport à `far`, jamais au span — sinon elle mesure le plan lointain qui la coupe.
    {
      name: 'high',
      seed,
      frames: 240,
      poseAt: () => ({ position: { x: 0, y: far * 0.45, z: far * 0.45 }, target: { x: 0, y: 0, z: 0 } }),
    },
  ]
}
