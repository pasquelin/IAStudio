import { mdiClose } from '@mdi/js'
import { memo, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { TIP_BOTTOM } from '@/helpers/tooltip'
import { ErrorBoundary } from '@/design/ErrorBoundary'
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

  // The id comes from persisted state: an entry from an older version names no component —
  // a tool this version dropped, not a failure to present as one.
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
          {/* Its own boundary, and an empty one: actions that throw must not take the close
              button with them, and a failure notice does not fit on a header row. */}
          {Actions !== undefined && (
            <ErrorBoundary key={tool} fallback={() => null}>
              {/* Inside the boundary: a panel chunk that fails to arrive is a failure like any
                  other, and must not escape past the header's own guard. */}
              <Suspense fallback={null}>
                <Actions />
              </Suspense>
            </ErrorBoundary>
          )}
        </PanelHeader>
        <div className="min-h-0 flex-1 overflow-auto">
          {/* Inside the panel, not around it: a tool that throws keeps its header, so it can
              still be closed. Keyed by the tool — the rail swaps `tool` on this same element,
              and a boundary left standing would hand its failure to the tool that replaced it. */}
          <ErrorBoundary key={tool}>
            <Suspense fallback={null}>
              <Content />
            </Suspense>
          </ErrorBoundary>
        </div>
      </Panel>
    </ToolZoneProvider>
  )
})
