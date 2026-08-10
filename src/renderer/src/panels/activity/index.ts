import type { ToolDefinition } from '@/panels/definition'
import { ActivityList } from '@/app/ActivityList'

/**
 * The journal, as the status bar's flyout already drew it — filters, empty state and all.
 *
 * The home used to keep a band of its own showing the last six entries. Two readings of one
 * store, and the shorter one could say nothing about what it had left out: the panel filters by
 * level and topic, which is the question anyone asking "what went wrong" actually has.
 */
export const definition: ToolDefinition = { Content: ActivityList }
