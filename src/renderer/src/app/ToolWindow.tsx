import { mdiClose } from '@mdi/js'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { TIP_BOTTOM } from '@/helpers/tooltip'
import { Panel } from '@/design/Panel'
import { PanelHeader } from '@/design/PanelHeader'
import { Separator } from '@/design/Separator'
import { ToolButton } from '@/design/ToolButton'
import { TOOL_COMPONENTS } from './tool-components'
import { isHorizontal, type ToolId, type ToolZone } from '@shared/domain/tool'
import { toolTitleKey } from '@/helpers/tool-registry'
import { ToolZoneProvider } from './tool-zone'

export type ToolWindowProps = {
  tool: ToolId
  /** The zone this window sits in, handed down to the panel so it can lay itself out for it. */
  zone: ToolZone
  /** Length of its own along the zone's inner axis. Absent takes whatever the other half left. */
  length?: number
  onFocus: () => void
  onClose: () => void
}

/**
 * Memoized: a zone drag writes a new size on every pointermove, and without this each frame
 * re-renders both halves and everything they contain — for the bottom strip, a virtualized
 * asset grid. Its callbacks must stay stable for that to bite; see `Edge`.
 *
 * A tool window: a dark rounded surface laid over the chassis gutter. One visible tool per
 * HALF of a zone — the rail switches between them, not a tab; tabs stay in the center, where
 * they carry document names.
 *
 * Closing is the only way out, on purpose. A collapsed panel is a third state between open and
 * closed that looks like neither, and the rail already reopens a tool in one click.
 */
export const ToolWindow = memo(function ToolWindow({
  tool,
  zone,
  length,
  onFocus,
  onClose,
}: ToolWindowProps) {
  const { t } = useTranslation()
  const definition = TOOL_COMPONENTS[tool]
  const title = t(toolTitleKey(tool))

  // The id comes from persisted state: an entry left over from an older version would
  // otherwise throw while rendering, with no error boundary above to catch it.
  if (!definition) return null
  const { Content, Actions, fillActions } = definition

  return (
    // Zone-wide, header included: a panel lays out differently in a narrow column and in a
    // strip across the window, and its own row is part of what changes.
    <ToolZoneProvider zone={zone}>
      {/* The zone owns its length: a half given one keeps it, the other takes what is left. Both
          sized here would make the pair overflow the zone the user dragged. */}
      <Panel
        aria-label={title}
        onPointerDownCapture={onFocus}
        // `shrink` overrides `Panel`'s own `shrink-0`: a half given a length must still give
        // ground when the zone is shorter than the two halves ask for, or it overflows the column.
        className={length === undefined ? 'flex-1 basis-0' : 'shrink'}
        style={length === undefined ? undefined : { flexBasis: length }}
      >
        <PanelHeader
          title={title}
          fillActions={fillActions === true && isHorizontal(zone)}
          trailing={
            <>
              {Actions !== undefined && <Separator />}
              <ToolButton
                icon={mdiClose}
                label={t('actions.removeTool')}
                tooltip={TIP_BOTTOM}
                variant="header"
                onClick={onClose}
              />
            </>
          }
        >
          {Actions !== undefined && <Actions />}
        </PanelHeader>
        <div className="min-h-0 flex-1 overflow-auto">
          <Content />
        </div>
      </Panel>
    </ToolZoneProvider>
  )
})
