import { mdiClose } from '@mdi/js'
import { memo, type HTMLAttributes, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/helpers/cn'
import { TIP_BOTTOM } from '@/helpers/tooltip'
import { Separator } from '@/design/Separator'
import { ToolButton } from '@/design/ToolButton'
import { TOOL_COMPONENTS } from './tool-components'
import type { ToolId } from '@shared/domain/tool'
import { toolTitleKey } from '@/helpers/tool-registry'

export type ToolWindowProps = {
  tool: ToolId
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
  const { Content, Actions } = definition

  return (
    // The zone owns its length: a half given one keeps it, the other takes what is left. Both
    // sized here would make the pair overflow the zone the user dragged.
    <Panel
      aria-label={title}
      onPointerDownCapture={onFocus}
      // `shrink` overrides `Panel`'s own `shrink-0`: a half given a length must still give
      // ground when the zone is shorter than the two halves ask for, or it overflows the column.
      className={length === undefined ? 'flex-1 basis-0' : 'shrink'}
      style={length === undefined ? undefined : { flexBasis: length }}
    >
      <PanelHeader title={title}>
        {Actions !== undefined && (
          <>
            <Actions />
            <Separator />
          </>
        )}
        <ToolButton
          icon={mdiClose}
          label={t('actions.removeTool')}
          tooltip={TIP_BOTTOM}
          variant="header"
          onClick={onClose}
        />
      </PanelHeader>
      <div className="min-h-0 flex-1 overflow-auto">
        <Content />
      </div>
    </Panel>
  )
})

export function Panel({ children, className, ...rest }: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn(
        'bg-base flex min-h-0 shrink-0 flex-col overflow-hidden rounded-(--radius-sc-lg)',
        className,
      )}
      {...rest}
    >
      {children}
    </section>
  )
}

function PanelHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="flex h-(--sc-header) shrink-0 items-center gap-1 pr-1.5 pl-3">
      <span className="text-text truncate text-[13px] font-semibold">{title}</span>
      <span className="ml-auto flex items-center gap-0.5">{children}</span>
    </header>
  )
}
