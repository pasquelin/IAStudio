import { mdiRedo, mdiUndo } from '@mdi/js'
import { Fragment, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from './cn'
import { Separator } from './Separator'
import { resolveSlot, type SlotConfig } from './slots'
import { TIP_TOP } from './tooltip'
import { ToolButton } from './ToolButton'

export type ToolbarSection = 'tools' | 'extras' | 'undo' | 'redo'

export type Tool = {
  id: string
  /** i18n key of the label — never the displayed text. */
  labelKey: string
  icon: string
  shortcut?: string
  disabled?: boolean
}

export type ToolbarProps = {
  /** Tools rendered, in order. */
  tools: Tool[]
  activeTool?: string
  onTool: (id: string) => void
  orientation?: 'vertical' | 'horizontal'
  /** Hides (`false`) or replaces (ReactNode) each section. */
  sections?: SlotConfig<ToolbarSection>
  /** Workspace tools, rendered after the built-in ones and in the same visual language. */
  extras?: ReactNode
  onUndo?: () => void
  onRedo?: () => void
  canUndo?: boolean
  canRedo?: boolean
  className?: string
}

/**
 * The studio's single toolbar, shared by all six workspaces. Each workspace provides only its
 * tool registry; geometry follows `--sc-control`, so the density setting applies everywhere
 * without any bar knowing its value.
 */
export function Toolbar({
  tools,
  activeTool,
  onTool,
  orientation = 'vertical',
  sections,
  extras,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  className,
}: ToolbarProps) {
  const { t } = useTranslation()
  const vertical = orientation === 'vertical'
  const slotTools = resolveSlot(sections, 'tools')
  const slotExtras = resolveSlot(sections, 'extras')
  const slotUndo = resolveSlot(sections, 'undo')
  const slotRedo = resolveSlot(sections, 'redo')

  return (
    <div
      role="toolbar"
      aria-orientation={vertical ? 'vertical' : 'horizontal'}
      className={cn(
        'border-border bg-surface flex items-center gap-0.5 rounded-(--radius-sc-lg) border p-1',
        'shadow-(--sc-shadow-furniture)',
        vertical ? 'flex-col' : 'flex-row',
        className,
      )}
    >
      {slotTools.visible &&
        (slotTools.replacement ?? (
          <Fragment>
            {tools.map(tool => (
              <ToolButton
                key={tool.id}
                icon={tool.icon}
                label={t(tool.labelKey)}
                shortcut={tool.shortcut}
                tooltip={TIP_TOP}
                active={tool.id === activeTool}
                disabled={tool.disabled}
                onClick={() => onTool(tool.id)}
              />
            ))}
          </Fragment>
        ))}

      {slotExtras.visible && (slotExtras.replacement ?? extras)}

      {(slotUndo.visible || slotRedo.visible) && (onUndo || onRedo) && (
        <Separator orientation={vertical ? 'horizontal' : 'vertical'} />
      )}

      {slotUndo.visible &&
        onUndo &&
        (slotUndo.replacement ?? (
          <ToolButton
            icon={mdiUndo}
            label={t('actions.undo')}
            shortcut="⌘Z"
            tooltip={TIP_TOP}
            disabled={!canUndo}
            onClick={onUndo}
          />
        ))}

      {slotRedo.visible &&
        onRedo &&
        (slotRedo.replacement ?? (
          <ToolButton
            icon={mdiRedo}
            label={t('actions.redo')}
            shortcut="⇧⌘Z"
            tooltip={TIP_TOP}
            disabled={!canRedo}
            onClick={onRedo}
          />
        ))}
    </div>
  )
}
