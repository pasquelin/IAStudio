import { mdiArrowAll, mdiAxisArrow, mdiCropFree, mdiDelete, mdiResize } from '@mdi/js'
import type { CommandId, Signature } from '@shared/domain/shortcut'
import type { Tool } from '@/design/Toolbar'

export type SceneTool = Tool & { command: CommandId }

/** The bar's registry. The bar itself is `design/Toolbar` — nothing is drawn here. */
export const SCENE_TOOLS: readonly SceneTool[] = [
  {
    id: 'translate',
    command: 'scene.translate',
    labelKey: 'sceneTools.translate',
    icon: mdiArrowAll,
  },
  { id: 'rotate', command: 'scene.rotate', labelKey: 'sceneTools.rotate', icon: mdiAxisArrow },
  { id: 'scale', command: 'scene.scale', labelKey: 'sceneTools.scale', icon: mdiResize },
  { id: 'frame', command: 'scene.frame', labelKey: 'sceneTools.frame', icon: mdiCropFree },
  { id: 'delete', command: 'scene.delete', labelKey: 'sceneTools.delete', icon: mdiDelete },
]

const MODIFIER_GLYPHS: Record<string, string> = {
  Ctrl: '⌃',
  Alt: '⌥',
  Shift: '⇧',
  Meta: '⌘',
}

/**
 * Turns a signature into what the tooltip shows. `KeyG` is a position, not a letter — but the
 * letter is what is printed on the key in front of the user, so that is what is displayed.
 */
export function shortcutLabel(signature: Signature): string {
  const parts = signature.split('+')
  const code = parts.at(-1) ?? ''
  const modifiers = parts.slice(0, -1).map(part => MODIFIER_GLYPHS[part] ?? part)
  const key = code.startsWith('Key') ? code.slice(3) : code
  return [...modifiers, key].join('')
}
