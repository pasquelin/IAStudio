import type { ToolId } from '@shared/domain/tool'
import type { ToolDefinition } from '@/panels/definition'
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

/**
 * Tool content table. Each panel publishes its own definition, so adding one is a folder and a
 * line here rather than an import and a pair recomposed by hand.
 */
export const TOOL_COMPONENTS: Record<ToolId, ToolDefinition> = {
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
}
