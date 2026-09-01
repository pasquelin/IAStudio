import type { ToolDefinition } from '@/features/shell/definition'
import { TimelineActions } from '../components/Timeline/TimelineActions'
import { TimelinePanel } from '../components/Timeline/TimelinePanel'

// `fillActions`: the animation transport is a whole bar, not a button or two — it takes the
// title row's free width rather than sitting on a second line above a band that is already short.
export const definition: ToolDefinition = {
  Content: TimelinePanel,
  Actions: TimelineActions,
  fillActions: true,
}
