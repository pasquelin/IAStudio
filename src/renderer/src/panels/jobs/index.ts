import type { ToolDefinition } from '@/panels/definition'
import { Jobs } from './Jobs'

/** The same list the status bar's flyout opens — see `domain/tool.ts` for why it sits there. */
export const definition: ToolDefinition = { Content: Jobs }
