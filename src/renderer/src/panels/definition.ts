import type { FC } from 'react'

/**
 * What a panel publishes about itself. Here rather than beside the table that collects them:
 * that table imports every panel, so a panel reading the type off it closed a cycle.
 */
export type ToolDefinition = {
  Content: FC
  /** Actions rendered in the title bar, on the same line as the panel name. */
  Actions?: FC
  /** Whether those actions take the title row's free width once the panel lies in a band, for
   * a panel that moves a whole bar up there rather than a button or two. Such an `Actions` owns
   * its end of the row: nothing pushes it against the close button any more. */
  fillActions?: boolean
}
