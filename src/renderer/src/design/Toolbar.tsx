import { mdiRedo, mdiUndo } from '@mdi/js'
import { Fragment, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from './cn'
import { Flyout } from './Flyout'
import { Separator } from './Separator'
import { resolveSlot, type SlotConfig } from './slots'
import { TIP_RIGHT, TIP_TOP } from './tooltip'
import { ToolButton } from './ToolButton'
import { UiIcon } from './UiIcon'
import { useHoverFlyout } from './useHoverFlyout'

export type ToolbarSection = 'tools' | 'extras' | 'undo' | 'redo'

export type ToolMode = {
  id: string
  /** i18n key of the label — never the displayed text. */
  labelKey: string
  icon: string
  shortcut?: string
}

export type Tool = {
  id: string
  /** i18n key of the label — never the displayed text. */
  labelKey: string
  icon: string
  shortcut?: string
  disabled?: boolean
  /** Two or more open a flyout on hover; one or none makes the button act directly. */
  modes?: readonly ToolMode[]
  activeMode?: string
}

export type ToolbarProps = {
  /** Tools rendered, in order. */
  tools: Tool[]
  activeTool?: string
  onTool: (id: string) => void
  /** Called when a row of a tool's flyout is chosen. */
  onMode?: (toolId: string, modeId: string) => void
  orientation?: 'vertical' | 'horizontal'
  /** Hides (`false`) or replaces (ReactNode) each section. */
  sections?: SlotConfig<ToolbarSection>
  /** Workspace tools, rendered after the built-in ones and in the same visual language. */
  extras?: ReactNode
  onUndo?: () => void
  onRedo?: () => void
  /** Shown on the undo/redo tooltips. Absent leaves them unlabelled rather than lying. */
  undoShortcut?: string
  redoShortcut?: string
  canUndo?: boolean
  canRedo?: boolean
  className?: string
}

/**
 * The studio's single toolbar, meant to be shared by every workspace: each one will provide
 * only its tool registry. No workspace mounts it yet — `spaces/` does not exist.
 *
 * Geometry follows `--sc-control`, so the density setting reaches it without the bar ever
 * knowing its value.
 */
export function Toolbar({
  tools,
  activeTool,
  onTool,
  onMode,
  orientation = 'vertical',
  sections,
  extras,
  onUndo,
  onRedo,
  undoShortcut,
  redoShortcut,
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
              <ToolItem
                key={tool.id}
                tool={tool}
                active={tool.id === activeTool}
                onTool={onTool}
                onMode={onMode}
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
            shortcut={undoShortcut}
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
            shortcut={redoShortcut}
            tooltip={TIP_TOP}
            disabled={!canRedo}
            onClick={onRedo}
          />
        ))}
    </div>
  )
}

type ToolItemProps = {
  tool: Tool
  active: boolean
  onTool: (id: string) => void
  onMode?: (toolId: string, modeId: string) => void
}

/**
 * A tool and, when it has several, its modes. Taken from map3D's `EraseToolButton`: the button
 * always acts on click, and the flyout only offers to switch mode — so an armed tool never
 * needs the menu to be reachable.
 */
function ToolItem({ tool, active, onTool, onMode }: ToolItemProps) {
  const { t } = useTranslation()
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null)
  const flyout = useHoverFlyout(tool.modes?.length ?? 0)

  return (
    <div {...flyout.wrapProps} className="contents">
      <ToolButton
        ref={setAnchor}
        icon={tool.icon}
        label={t(tool.labelKey)}
        shortcut={tool.shortcut}
        tooltip={TIP_TOP}
        active={active}
        disabled={tool.disabled}
        onClick={() => onTool(tool.id)}
      />

      {flyout.showing && (
        <Flyout anchor={anchor} {...flyout.flyoutProps}>
          {tool.modes?.map(mode => (
            <button
              key={mode.id}
              type="button"
              role="menuitem"
              {...TIP_RIGHT(t(mode.labelKey), mode.shortcut)}
              className={cn(
                'text-muted hover:bg-elevated hover:text-text flex cursor-pointer items-center',
                'h-(--sc-control) gap-2 rounded-(--radius-sc-md) border-none bg-transparent px-2',
                'text-left text-[11px] transition-colors',
                active && tool.activeMode === mode.id && 'bg-accent hover:bg-accent text-white',
              )}
              onClick={() => {
                onMode?.(tool.id, mode.id)
                flyout.close()
              }}
            >
              <UiIcon path={mode.icon} size={14} />
              <span className="truncate">{t(mode.labelKey)}</span>
            </button>
          ))}
        </Flyout>
      )}
    </div>
  )
}
