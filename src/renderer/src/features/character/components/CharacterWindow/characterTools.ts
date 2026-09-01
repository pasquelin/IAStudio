import {
  mdiArrowAll,
  mdiAxisArrow,
  mdiBone,
  mdiCursorDefaultOutline,
  mdiRulerSquare,
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
 * The one toggle of this bar: a joint dragged keeps its distance to its parent, so the bone TURNS
 * instead of stretching.
 *
 * Not a mode — it qualifies whichever one is armed, exactly as the scene's magnet qualifies its
 * three verbs. A bone stretched to the floor is what a hand asking for a hundred pixels got
 * without it, and almost never what it meant.
 */
export const CHARACTER_LOCK_LENGTHS = 'lockLengths'

export const CHARACTER_LOCK_TOOL: ToolbarItem = {
  id: CHARACTER_LOCK_LENGTHS,
  labelKey: 'character.lockLengths',
  descriptionKey: 'character.lockLengthsHint',
  icon: mdiRulerSquare,
  separatorBefore: true,
}

/**
 * The other toggle: whether a joint dragged is being PUT where it belongs, or POSED.
 *
 * Off is posing, and that is the arbitration: the mesh follows a bone the hand moves, which is
 * what one opens this window to do. Editing the rest is the correction of a fit, and there the
 * mesh must stay still — a joint pulled into the elbow it belongs in took the whole arm with it.
 */
export const CHARACTER_EDIT_REST = 'editRest'

export const CHARACTER_REST_TOOL: ToolbarItem = {
  id: CHARACTER_EDIT_REST,
  labelKey: 'character.editRest',
  descriptionKey: 'character.editRestHint',
  icon: mdiBone,
}
