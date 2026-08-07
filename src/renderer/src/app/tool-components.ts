import type { FC } from 'react'
import type { ToolId } from '@shared/domain/tool'
import { definition as assets } from '@/panels/assets'
import { definition as explorer } from '@/panels/explorer'
import { definition as generator } from '@/panels/generator'
import { definition as jobs } from '@/panels/jobs'
import { definition as layers } from '@/panels/layers'
import { definition as models } from '@/panels/models'

export type ToolDefinition = {
  Content: FC
  /** Actions rendered in the title bar, on the same line as the panel name. */
  Actions?: FC
}

/**
 * Tool content table. Each panel publishes its own definition, so adding one is a folder and a
 * line here rather than an import and a pair recomposed by hand.
 */
export const TOOL_COMPONENTS: Record<ToolId, ToolDefinition> = {
  layers,
  explorer,
  models,
  generator,
  assets,
  jobs,
}
