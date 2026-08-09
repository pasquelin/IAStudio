import { lazy } from 'react'
import type { ToolId } from '@shared/domain/tool'
import type { ToolDefinition } from '@/panels/definition'

/**
 * What the title row must know about a panel before that panel's chunk arrives.
 *
 * `'actions'` says the panel publishes buttons for its header, `'fill-actions'` that they take
 * the row's free width in a band. Declared here rather than read off the panel, because the
 * header lays itself out on the first paint: a separator that turned up a frame later would
 * shift a row already on screen. `tool-components.test.ts` holds both to what the panels do.
 */
type HeaderRole = 'actions' | 'fill-actions'

/** A panel that publishes no actions still needs something for `lazy` to resolve to. */
const NoActions = () => null

function panel(
  load: () => Promise<{ definition: ToolDefinition }>,
  role?: HeaderRole,
): ToolDefinition {
  return {
    Content: lazy(async () => ({ default: (await load()).definition.Content })),
    // One `import()` for both halves: the module resolves once, and the second `lazy` reads it
    // from the module cache rather than asking for the chunk again.
    Actions:
      role === undefined
        ? undefined
        : lazy(async () => ({ default: (await load()).definition.Actions ?? NoActions })),
    fillActions: role === 'fill-actions',
  }
}

/**
 * Tool content table. Each panel publishes its own definition, so adding one is a folder and a
 * line here rather than an import and a pair recomposed by hand.
 *
 * Every panel is loaded on demand. The home screen opens ONE of them, and importing them all
 * outright held `engines/`, four helpers of the editors' folders and the usage formatter in the
 * chunk the splash screen waits for. `eager-graph.test.ts` states the property;
 * `tool-components.test.ts` holds the header flags below to the truth.
 */
export const TOOL_COMPONENTS: Record<ToolId, ToolDefinition> = {
  layers: panel(() => import('@/panels/layers'), 'actions'),
  meshes: panel(() => import('@/panels/meshes'), 'actions'),
  lights: panel(() => import('@/panels/lights'), 'actions'),
  timeline: panel(() => import('@/panels/timeline'), 'actions'),
  explorer: panel(() => import('@/panels/explorer')),
  scene: panel(() => import('@/panels/scene')),
  models: panel(() => import('@/panels/models')),
  generator: panel(() => import('@/panels/generator')),
  inspector: panel(() => import('@/panels/inspector')),
  skybox: panel(() => import('@/panels/skybox')),
  assets: panel(() => import('@/panels/assets'), 'fill-actions'),
  channels: panel(() => import('@/panels/channels')),
  styles: panel(() => import('@/panels/styles')),
  view: panel(() => import('@/panels/view')),
  apps: panel(() => import('@/panels/apps')),
}
