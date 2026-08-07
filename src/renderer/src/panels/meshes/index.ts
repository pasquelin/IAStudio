import type { ToolDefinition } from '@/app/tool-components'
import { MeshesActions, MeshesPanel } from './MeshesPanel'

export const definition: ToolDefinition = { Content: MeshesPanel, Actions: MeshesActions }
