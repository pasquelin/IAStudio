import { describe, expect, it } from 'vitest'
import type { ToolId } from '@shared/domain/tool'
import type { ToolDefinition } from '@/panels/definition'
import { definition as apps } from '@/panels/apps'
import { definition as assets } from '@/panels/assets'
import { definition as channels } from '@/panels/channels'
import { definition as explorer } from '@/panels/explorer'
import { definition as generator } from '@/panels/generator'
import { definition as inspector } from '@/panels/inspector'
import { definition as layers } from '@/panels/layers'
import { definition as lights } from '@/panels/lights'
import { definition as meshes } from '@/panels/meshes'
import { definition as models } from '@/panels/models'
import { definition as scene } from '@/panels/scene'
import { definition as skybox } from '@/panels/skybox'
import { definition as timeline } from '@/panels/timeline'
import { definition as view } from '@/panels/view'
import { TOOL_COMPONENTS } from './tool-components'

/**
 * The panels themselves, imported outright — which only a test may do. `tool-components.ts`
 * knows them through `import()`, so what it says about their headers is a second copy of the
 * truth, and nothing but this file stops the two from drifting.
 *
 * Keyed on `ToolId`, like the table it checks: a panel added, renamed or dropped fails to
 * compile here rather than at a case, so the two cases below only have to weigh the headers.
 */
const PANELS: Record<ToolId, ToolDefinition> = {
  layers,
  meshes,
  lights,
  timeline,
  explorer,
  scene,
  models,
  generator,
  inspector,
  skybox,
  assets,
  channels,
  view,
  apps,
}

function idsWhere(
  table: Record<ToolId, ToolDefinition>,
  holds: (definition: ToolDefinition) => boolean,
): string[] {
  return Object.entries(table)
    .filter(([, definition]) => holds(definition))
    .map(([id]) => id)
    .sort()
}

describe('the tool table', () => {
  // The header draws its separator on the first paint, before the panel's chunk lands. Declaring
  // one for a panel that publishes none would put a divider beside an empty row, and forgetting
  // one would make the divider appear a frame after the row it separates.
  it('declares actions for exactly the panels that publish them', () => {
    expect(idsWhere(TOOL_COMPONENTS, tool => tool.Actions !== undefined)).toEqual(
      idsWhere(PANELS, tool => tool.Actions !== undefined),
    )
  })

  it('declares a filled action row for exactly the panels that ask for one', () => {
    expect(idsWhere(TOOL_COMPONENTS, tool => tool.fillActions === true)).toEqual(
      idsWhere(PANELS, tool => tool.fillActions === true),
    )
  })
})
