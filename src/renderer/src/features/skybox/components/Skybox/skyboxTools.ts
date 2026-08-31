import {
  mdiGrid,
  mdiPanoramaVariantOutline,
  mdiVectorSquare,
  mdiViewGridOutline,
  mdiWeatherSunny,
} from '@mdi/js'
import type { CommandId } from '@shared/domain/command'
import { SKYBOX_VIEWS, type SkyboxView } from '@shared/domain/skybox'
import type { ToolbarItem, ToolMode } from '@/components/Toolbar/tools'

/** How the sky is laid flat, as a glyph. The button wears the one in use. */
const VIEW_ICONS: Record<SkyboxView, string> = {
  immersive: mdiPanoramaVariantOutline,
  equirect: mdiVectorSquare,
  cross: mdiGrid,
  faces: mdiViewGridOutline,
}

/** i18n key of a projection. Read by the View panel too — one word, one place. */
export const SKYBOX_VIEW_LABELS: Record<SkyboxView, string> = {
  immersive: 'skybox.viewImmersive',
  equirect: 'skybox.viewEquirect',
  cross: 'skybox.viewCross',
  faces: 'skybox.viewFaces',
}

const VIEW_MODES: readonly ToolMode[] = SKYBOX_VIEWS.map(view => ({
  id: view,
  labelKey: SKYBOX_VIEW_LABELS[view],
  descriptionKey: 'view.modeHint',
  icon: VIEW_ICONS[view],
}))

/** Every button carries its command, as the 3D bar does: no ternary reads an id in a component. */
export type SkyboxTool = ToolbarItem & { command: CommandId }

/**
 * The bar's registry. The bar itself is `design/Toolbar` — nothing is drawn here.
 *
 * The View panel offers these same two, and that is the point: they are switched while LOOKING,
 * and a panel has to be open to be reached. What a slider drives stays there — laid over the
 * picture it would cover the sky.
 */
export const SKYBOX_TOOLS: readonly SkyboxTool[] = [
  {
    id: 'view',
    command: 'skybox.view',
    labelKey: 'view.projection',
    descriptionKey: 'view.modeHint',
    icon: VIEW_ICONS.immersive,
    modes: VIEW_MODES,
    // Its click CYCLES: an action, not a toggle, whatever the armed mode says.
    acts: true,
  },
  {
    id: 'probes',
    command: 'skybox.probes',
    labelKey: 'skybox.testObjects',
    descriptionKey: 'skybox.testObjectsHint',
    icon: mdiWeatherSunny,
    separatorBefore: true,
  },
]

/** The bar hands back a plain string; this is where a row becomes a projection again. */
export function skyboxViewFrom(modeId: string): SkyboxView | null {
  return SKYBOX_VIEWS.find(view => view === modeId) ?? null
}
