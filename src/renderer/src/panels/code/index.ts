import type { ToolDefinition } from '@/panels/definition'
import { Code } from './Code'
import { CodeActions } from './CodeActions'

export const definition: ToolDefinition = {
  Content: Code,
  Actions: CodeActions,
  fillActions: true,
}
