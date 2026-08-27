/**
 * What « Nouveau projet ▸ Third Person » puts in a scene.
 *
 * 🛑 An ASSEMBLY, never an engine. Every one of these is a list of nodes carrying components the
 * runtime already has systems for — the plan says it in as many words, and it is what keeps a
 * template from becoming a second way of playing. A template that needed code would be a feature
 * pretending to be a preset.
 *
 * Here rather than in the renderer because the MAIN process offers them too, on the window that
 * makes a project: `shared/` is where both sides read the same list.
 */
import type { ComponentType } from './component'
import type { PlayCamera, ScenePlay } from './scene'

/** One object a template puts down: what it looks like, where, and what it DOES. */
export type TemplatePiece = {
  name: string
  /** A box, for everything a template stands on or moves. Sized in metres. */
  size: { x: number; y: number; z: number }
  at: { x: number; y: number; z: number }
  /** What the runtime is to do with it, by the components it carries and their settings. */
  components: readonly {
    type: ComponentType
    settings?: Readonly<Record<string, number | string | boolean>>
  }[]
}

export type GameTemplate = {
  id: string
  /** i18n key of the name a person picks it by — never the words themselves. */
  titleKey: string
  descriptionKey: string
  /** How the scene is watched and walked. What `world.play` is set to. */
  play: ScenePlay
  pieces: readonly TemplatePiece[]
}

const walking = (camera: PlayCamera, eyeHeight: number): ScenePlay => ({
  camera,
  eyeHeight,
  moveSpeed: 4,
  // 🛑 Not zero, unlike `DEFAULT_PLAY`: a template whose whole point is walking must fall.
  gravity: 9.81,
})

/** A floor every template stands on: static, and wide enough that nobody walks off it at once. */
const FLOOR: TemplatePiece = {
  name: 'Sol',
  size: { x: 40, y: 0.5, z: 40 },
  at: { x: 0, y: -0.25, z: 0 },
  components: [{ type: 'Collider', settings: { fidelity: 'box' } }],
}

/** Whoever is played: a body the controller drives, at the height a person reads as human. */
const HERO: TemplatePiece = {
  name: 'Personnage',
  size: { x: 0.6, y: 1.8, z: 0.6 },
  at: { x: 0, y: 0.9, z: 0 },
  components: [{ type: 'CharacterController' }, { type: 'Health' }],
}

const CRATE = (at: TemplatePiece['at'], name: string): TemplatePiece => ({
  name,
  size: { x: 1, y: 1, z: 1 },
  at,
  components: [{ type: 'Collider' }, { type: 'RigidBody' }],
})

/**
 * 🛑 Every template is the SAME pieces arranged differently, and that is the point: what changes
 * between them is how the scene is watched, not what the runtime can do.
 */
export const GAME_TEMPLATES: readonly GameTemplate[] = [
  {
    id: 'thirdPerson',
    titleKey: 'game.templates.thirdPerson.title',
    descriptionKey: 'game.templates.thirdPerson.description',
    play: walking('thirdPerson', 1.7),
    pieces: [
      FLOOR,
      HERO,
      CRATE({ x: 3, y: 0.5, z: -2 }, 'Caisse'),
      CRATE({ x: 3, y: 1.5, z: -2 }, 'Caisse 2'),
    ],
  },
  {
    id: 'firstPerson',
    titleKey: 'game.templates.firstPerson.title',
    descriptionKey: 'game.templates.firstPerson.description',
    play: walking('firstPerson', 1.7),
    pieces: [FLOOR, HERO, CRATE({ x: 2, y: 0.5, z: -3 }, 'Caisse')],
  },
  {
    id: 'topDown',
    titleKey: 'game.templates.topDown.title',
    descriptionKey: 'game.templates.topDown.description',
    play: walking('topDown', 8),
    pieces: [
      FLOOR,
      HERO,
      CRATE({ x: -3, y: 0.5, z: 0 }, 'Caisse'),
      CRATE({ x: 3, y: 0.5, z: 0 }, 'Caisse 2'),
    ],
  },
  {
    /** A scene that is LOOKED at rather than walked: no controller, and nothing falls. */
    id: 'showcase',
    titleKey: 'game.templates.showcase.title',
    descriptionKey: 'game.templates.showcase.description',
    play: { camera: 'orbit', eyeHeight: 1.7, moveSpeed: 4, gravity: 0 },
    pieces: [
      FLOOR,
      { ...CRATE({ x: 0, y: 0.5, z: 0 }, 'Objet'), components: [{ type: 'Collider' }] },
    ],
  },
]

export const GAME_TEMPLATE_IDS: readonly string[] = GAME_TEMPLATES.map(one => one.id)

export const gameTemplate = (id: string): GameTemplate | null =>
  GAME_TEMPLATES.find(one => one.id === id) ?? null
