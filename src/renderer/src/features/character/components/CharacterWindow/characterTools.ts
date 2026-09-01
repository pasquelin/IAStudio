import { mdiArrowAll, mdiAxisArrow, mdiCursorDefaultOutline, mdiResize } from '@mdi/js'
import type { TransformMode } from '@/engines/scene/gizmoTarget'
import type { ToolbarItem } from '@/components/Toolbar/tools'

/**
 * The bar of the skeleton window: the four ways a hand acts on the joint it picked.
 *
 * The scene's own words, deliberately — these are the same four verbs, and a second set of keys
 * would be four sentences free to drift from the four they translate.
 *
 * Four buttons and no flyout, for the reason `SCENE_TOOLS` gives: one switches between them by
 * the minute. Placing a joint is `translate`, which is why the window opens on it and not on
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
  {
    id: 'scale',
    mode: 'scale',
    labelKey: 'sceneTools.scale',
    descriptionKey: 'sceneTools.scaleHint',
    icon: mdiResize,
  },
]
