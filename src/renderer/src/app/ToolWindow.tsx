import { mdiClose, mdiWindowMinimize } from '@mdi/js'
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/design/cn'
import { TIP_BOTTOM } from '@/design/tooltip'
import { Separator } from '@/design/Separator'
import { ToolButton } from '@/design/ToolButton'
import { TOOL_COMPONENTS } from './tool-components'
import { isHorizontal, toolTitleKey, type ToolId, type ToolZone } from './tools'

export type ToolWindowProps = {
  zone: ToolZone
  tool: ToolId
  size: number
  collapsed: boolean
  onFocus: () => void
  onCollapse: () => void
  onClose: () => void
}

/**
 * A tool window: a dark rounded surface laid over the chassis gutter. One visible tool per
 * zone — the rail switches between them, not a tab; tabs stay in the center, where they carry
 * document names.
 */
export function ToolWindow({
  zone,
  tool,
  size,
  collapsed,
  onFocus,
  onCollapse,
  onClose,
}: ToolWindowProps) {
  const { t } = useTranslation()
  const { Content, Actions } = TOOL_COMPONENTS[tool]
  const title = t(toolTitleKey(tool))
  const lying = isHorizontal(zone)

  return (
    <Panel
      aria-label={title}
      onPointerDownCapture={onFocus}
      style={collapsed ? undefined : { [lying ? 'height' : 'width']: size }}
      className={cn(collapsed && 'shrink-0')}
    >
      <PanelHeader title={title}>
        {Actions !== undefined && (
          <>
            <Actions />
            <Separator />
          </>
        )}
        <ToolButton
          icon={mdiWindowMinimize}
          label={t('actions.collapse')}
          tooltip={TIP_BOTTOM}
          variant="header"
          onClick={onCollapse}
        />
        <ToolButton
          icon={mdiClose}
          label={t('actions.removeTool')}
          tooltip={TIP_BOTTOM}
          variant="header"
          onClick={onClose}
        />
      </PanelHeader>
      {!collapsed && (
        <div className="min-h-0 flex-1 overflow-auto">
          <Content />
        </div>
      )}
    </Panel>
  )
}

export function Panel({
  children,
  style,
  className,
  ...rest
}: {
  children: ReactNode
  style?: CSSProperties
} & HTMLAttributes<HTMLElement>) {
  return (
    <section
      style={style}
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

export function PanelHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="flex h-(--sc-header) shrink-0 items-center gap-1 pr-1.5 pl-3">
      <span className="text-text truncate text-[13px] font-semibold">{title}</span>
      <span className="ml-auto flex items-center gap-0.5">{children}</span>
    </header>
  )
}
