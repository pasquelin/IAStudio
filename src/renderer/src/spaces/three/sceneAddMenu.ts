import type { TFunction } from 'i18next'
import { showContextMenu } from '@/helpers/contextMenu'
import { ADD_TOOLS } from './sceneTools'

export type SceneAddMenuProps = {
  /** The window's translator, as every menu of this studio takes it — see `openSceneNodeMenu`. */
  t: TFunction
  /** Where a row lands: `addNodeTo`, the same door the toolbar's three flyouts use. */
  onAdd: (kind: string) => void
}

/**
 * What a scene can RECEIVE — right-clicked on empty space, or opened by ⇧A.
 *
 * The toolbar's own three buttons, drawn as the system draws menus: one row per family, its kinds
 * underneath. `ADD_TOOLS` rather than the registry it derives from, so a kind added to a family
 * arrives in both at once — the derivation of those keys was written twice already.
 */
export function openSceneAddMenu({ t, onAdd }: SceneAddMenuProps): void {
  void showContextMenu(
    ADD_TOOLS.map(family => ({
      label: t(family.labelKey),
      icon: family.icon,
      tooltip: t(family.descriptionKey),
      rows: (family.modes ?? []).map(mode => ({
        label: t(mode.labelKey),
        icon: mode.icon,
        disabled: mode.disabled,
        tooltip: t(mode.descriptionKey),
        onSelect: () => onAdd(mode.id),
      })),
      // A family with no kinds takes ITSELF out rather than the menu: the main process refuses an
      // empty submenu, and it refuses the whole payload with it — silently, since nothing is drawn
      // to hint at a menu that never opened.
    })).filter(family => family.rows.length > 0),
  )
}
