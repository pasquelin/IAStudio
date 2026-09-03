import {
  mdiArrowAll,
  mdiAxisArrow,
  mdiBone,
  mdiCursorDefaultOutline,
  mdiHumanHandsup,
} from '@mdi/js'
import type { TransformMode } from '@/engines/scene/gizmoTarget'
import type { ToolbarItem } from '@/components/Toolbar/tools'

/**
 * The bar of the skeleton window: the three ways a hand acts on the joint it picked.
 *
 * The scene's own words, deliberately — these are the same verbs, and a second set of keys would
 * be sentences free to drift from the ones they translate.
 *
 * 🛑 No SCALE, and that is the arbitration rather than an omission: a joint is a point and a
 * length, and there is nothing about one to enlarge — a scaled bone scales everything hanging
 * off it, which is a deformation of the character and never an edit of its skeleton.
 *
 * Buttons and no flyout, for the reason `SCENE_TOOLS` gives: one switches between them by the
 * minute. Placing a joint is `translate`, which is why the window opens on it and not on
 * `select` — a skeleton read off a bounding box is a skeleton one immediately corrects.
 */
export const CHARACTER_TOOLS: readonly (ToolbarItem & { mode: TransformMode })[] = [
  {
    id: 'select',
    mode: 'select',
    labelKey: 'sceneTools.select',
    descriptionKey: 'sceneTools.selectHint',
    icon: mdiCursorDefaultOutline,
  },
  {
    id: 'translate',
    mode: 'translate',
    labelKey: 'sceneTools.translate',
    descriptionKey: 'sceneTools.translateHint',
    icon: mdiArrowAll,
  },
  {
    id: 'rotate',
    mode: 'rotate',
    labelKey: 'sceneTools.rotate',
    descriptionKey: 'sceneTools.rotateHint',
    icon: mdiAxisArrow,
  },
]

/**
 * The STATE the window is in, and the two are exclusive: one places a skeleton on a model, the
 * other plays with the model. Drawn like the verbs above — exactly one lit — because two toggles
 * lit side by side read as two modes at once, which is what a hand saw and what it is not.
 *
 * 🛑 No padlock on the lengths any more. It was a dressing on a wound now closed: posing turns
 * the bone arriving at a joint, so no length can change there, and editing a skeleton is where
 * one shortens a bone that came out too long — holding it forbade the state's only gesture.
 */
export const CHARACTER_POSE = 'poseCharacter'
export const CHARACTER_EDIT_REST = 'editSkeleton'

export const CHARACTER_STATE_TOOLS: readonly ToolbarItem[] = [
  {
    id: CHARACTER_POSE,
    labelKey: 'character.manipulate',
    descriptionKey: 'character.manipulateHint',
    icon: mdiHumanHandsup,
    separatorBefore: true,
  },
  {
    id: CHARACTER_EDIT_REST,
    labelKey: 'character.editRest',
    descriptionKey: 'character.editRestHint',
    icon: mdiBone,
  },
]
