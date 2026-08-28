import {
  mdiArrowExpandAll,
  mdiCheckboxMarkedOutline,
  mdiContentCopy,
  mdiFitToScreenOutline,
  mdiFolderPlusOutline,
  mdiFormatText,
  mdiFormTextbox,
  mdiGestureTapButton,
  mdiGrid,
  mdiImageOutline,
  mdiLockOutline,
  mdiMagnifyMinusOutline,
  mdiMagnifyPlusOutline,
  mdiMonitorScreenshot,
  mdiRectangleOutline,
  mdiTimerSandEmpty,
  mdiTrashCanOutline,
  mdiTuneVariant,
  mdiUnfoldMoreHorizontal,
  mdiViewAgendaOutline,
  mdiViewSequentialOutline,
} from '@mdi/js'
import { UI_ELEMENT_TYPES, type UiElementType } from '@shared/domain/ui'
import { UI_RESOLUTION_IDS } from '@shared/domain/uiResolution'
import type { ToolbarItem, ToolMode } from '@/design/Toolbar/tools'

/**
 * What the interface editor's bar offers. Actions rather than modes: the one armed tool an
 * editor needs is a pointer, and what a drag DOES with it arrives with the direct-manipulation
 * lot — a bar offering a gesture nothing answers would promise what it cannot do.
 */
export const GUI_ADD_TOOL = 'gui.add'

export const GUI_RESOLUTION_TOOL = 'gui.resolution'

/** A `Record` over the closed list, so a fourteenth type does not compile until it has a glyph. */
const TYPE_ICONS: Record<UiElementType, string> = {
  screen: mdiMonitorScreenshot,
  panel: mdiRectangleOutline,
  stack: mdiViewAgendaOutline,
  grid: mdiGrid,
  scroll: mdiViewSequentialOutline,
  spacer: mdiUnfoldMoreHorizontal,
  text: mdiFormatText,
  image: mdiImageOutline,
  button: mdiGestureTapButton,
  progress: mdiTimerSandEmpty,
  slider: mdiTuneVariant,
  input: mdiFormTextbox,
  checkbox: mdiCheckboxMarkedOutline,
}

export const uiTypeIcon = (type: UiElementType): string => TYPE_ICONS[type]

/** Everything but the screen: a document holds exactly one, and it is the document. */
export const ADDABLE_UI_TYPES: readonly UiElementType[] = UI_ELEMENT_TYPES.filter(
  type => type !== 'screen',
)

const ADD_MODES: readonly ToolMode[] = ADDABLE_UI_TYPES.map(type => ({
  id: type,
  labelKey: `guiTools.types.${type}`,
  descriptionKey: `guiTools.typeHints.${type}`,
  icon: TYPE_ICONS[type],
}))

const RESOLUTION_MODES: readonly ToolMode[] = UI_RESOLUTION_IDS.map(id => ({
  id,
  labelKey: `guiTools.resolutions.${id}`,
  descriptionKey: `guiTools.resolutionHints.${id}`,
  icon: mdiMonitorScreenshot,
}))

export const GUI_TOOLS: readonly ToolbarItem[] = [
  {
    id: GUI_ADD_TOOL,
    labelKey: 'guiTools.add',
    descriptionKey: 'guiTools.addHint',
    icon: mdiRectangleOutline,
    acts: true,
    modes: ADD_MODES,
  },
  {
    id: 'gui.duplicate',
    labelKey: 'guiTools.duplicate',
    descriptionKey: 'guiTools.duplicateHint',
    icon: mdiContentCopy,
    acts: true,
  },
  {
    id: 'gui.group',
    labelKey: 'guiTools.group',
    descriptionKey: 'guiTools.groupHint',
    icon: mdiFolderPlusOutline,
    acts: true,
  },
  {
    id: 'gui.delete',
    labelKey: 'guiTools.delete',
    descriptionKey: 'guiTools.deleteHint',
    icon: mdiTrashCanOutline,
    acts: true,
  },
  {
    id: 'gui.lock',
    labelKey: 'guiTools.lock',
    descriptionKey: 'guiTools.lockHint',
    icon: mdiLockOutline,
    acts: true,
    separatorBefore: true,
  },
  {
    id: 'gui.zoomIn',
    labelKey: 'guiTools.zoomIn',
    descriptionKey: 'guiTools.zoomInHint',
    icon: mdiMagnifyPlusOutline,
    acts: true,
    separatorBefore: true,
  },
  {
    id: 'gui.zoomOut',
    labelKey: 'guiTools.zoomOut',
    descriptionKey: 'guiTools.zoomOutHint',
    icon: mdiMagnifyMinusOutline,
    acts: true,
  },
  {
    id: 'gui.fit',
    labelKey: 'guiTools.fit',
    descriptionKey: 'guiTools.fitHint',
    icon: mdiFitToScreenOutline,
    acts: true,
  },
  {
    id: 'gui.actual',
    labelKey: 'guiTools.actual',
    descriptionKey: 'guiTools.actualHint',
    icon: mdiArrowExpandAll,
    acts: true,
  },
  {
    id: GUI_RESOLUTION_TOOL,
    labelKey: 'guiTools.resolution',
    descriptionKey: 'guiTools.resolutionHint',
    icon: mdiMonitorScreenshot,
    acts: true,
    modes: RESOLUTION_MODES,
    separatorBefore: true,
  },
]
