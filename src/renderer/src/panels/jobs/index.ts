import type { ToolDefinition } from '@/panels/definition'
import { Jobs } from './Jobs'

/**
 * The same list the status bar's flyout opens, given a half of the home's right column. It was a
 * band there, showing the running jobs only and vanishing when none were: two readings of one
 * thing, one of which disappeared. The panel is the flyout's, whole.
 */
export const definition: ToolDefinition = { Content: Jobs }
