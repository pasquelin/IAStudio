import { mdiRedo, mdiUndo } from '@mdi/js'
import { Fragment, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/helpers/cn'
import { Flyout } from './Flyout'
import { MenuRow } from './MenuRow'
import { Separator } from './Separator'
import { tipFor, type TooltipFactory } from '@/helpers/tooltip'
import { ToolButton } from './ToolButton'
import { useHoverFlyout } from '../hooks/useHoverFlyout'

export type ToolMode = {
  id: string
  /** i18n key of the label — never the displayed text. */
  labelKey: string
  /** i18n key of the one-line tooltip. Absent tips the label, which is better than nothing. */
  descriptionKey?: string
  icon: string
  shortcut?: string
  /** Declared but not wired yet: shown greyed, so the bar never hides what is coming. */
  disabled?: boolean
}

export type ToolbarItem = {
  id: string
  /** i18n key of the label — never the displayed text. */
  labelKey: string
  /** i18n key of the one-line tooltip. Absent tips the label, which is better than nothing. */
  descriptionKey?: string
  icon: string
  shortcut?: string
  disabled?: boolean
  /** Two or more open a flyout on hover; one or none makes the button act directly. */
  modes?: readonly ToolMode[]
  activeMode?: string
  /** Draws a divider before this tool, so the bar reads as groups and not a run of icons. */
  separatorBefore?: boolean
}

export type ToolbarProps = {
  /** Tools rendered, in order. */
  tools: ToolbarItem[]
  activeTool?: string
  onTool: (id: string) => void
  /** Called when a row of a tool's flyout is chosen. */
  onMode?: (toolId: string, modeId: string) => void
  orientation?: 'vertical' | 'horizontal'
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
 * The studio's single toolbar, shared by every workspace: each one provides only its registry.
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
  // A vertical bar hugs the left edge, so its tooltips go right — placed on top they would sit
  // over the button above and cover the tool the eye is comparing against.
  const tip = tipFor(orientation)
  const modeTip = tipFor(orientation, 'flyout')
  const divider = <Separator orientation={vertical ? 'horizontal' : 'vertical'} />

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
      {tools.map(tool => (
        <Fragment key={tool.id}>
          {tool.separatorBefore && divider}
          <ToolItem
            tool={tool}
            active={tool.id === activeTool}
            tip={tip}
            modeTip={modeTip}
            onTool={onTool}
            onMode={onMode}
          />
        </Fragment>
      ))}

      {extras}

      {(onUndo || onRedo) && divider}

      {onUndo && (
        <HistoryButton
          icon={mdiUndo}
          label={t('actions.undo')}
          description={t('actions.undoHint')}
          shortcut={undoShortcut}
          tip={tip}
          enabled={canUndo}
          onClick={onUndo}
        />
      )}

      {onRedo && (
        <HistoryButton
          icon={mdiRedo}
          label={t('actions.redo')}
          description={t('actions.redoHint')}
          shortcut={redoShortcut}
          tip={tip}
          enabled={canRedo}
          onClick={onRedo}
        />
      )}
    </div>
  )
}

/** Undo and redo differ only by their icon and their label, so they are one component twice. */
function HistoryButton({
  icon,
  label,
  description,
  shortcut,
  tip,
  enabled,
  onClick,
}: {
  icon: string
  label: string
  description: string
  shortcut?: string
  tip: TooltipFactory
  enabled: boolean
  onClick: () => void
}) {
  return (
    <ToolButton
      icon={icon}
      label={label}
      description={description}
      shortcut={shortcut}
      tooltip={tip}
      disabled={!enabled}
      onClick={onClick}
    />
  )
}

type ToolItemProps = {
  tool: ToolbarItem
  active: boolean
  /** Placement of the button's own tooltip, and of its flyout rows' — both follow the bar. */
  tip: TooltipFactory
  modeTip: TooltipFactory
  onTool: (id: string) => void
  onMode?: (toolId: string, modeId: string) => void
}

/**
 * A tool and, when it has several, its modes. Taken from map3D's `EraseToolButton`: the button
 * always acts on click, and the flyout only offers to switch mode — so an armed tool never
 * needs the menu to be reachable.
 */
function ToolItem({ tool, active, tip, modeTip, onTool, onMode }: ToolItemProps) {
  const { t } = useTranslation()
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null)
  const flyout = useHoverFlyout(tool.modes?.length ?? 0)

  // The button wears the armed mode's icon: a shapes tool armed with the ellipse has to look
  // like an ellipse, or the bar stops saying what the next click will draw.
  const armed = tool.modes?.find(mode => mode.id === tool.activeMode)
  const description = armed?.descriptionKey ?? tool.descriptionKey

  return (
    <div {...flyout.wrapProps} className="contents">
      <ToolButton
        ref={setAnchor}
        icon={armed?.icon ?? tool.icon}
        label={t(armed?.labelKey ?? tool.labelKey)}
        description={description ? t(description) : undefined}
        // No `??` onto the tool's own: a group's shortcut belongs to its first mode, and
        // showing it on another one contradicts the menu row right below.
        shortcut={tool.modes ? armed?.shortcut : tool.shortcut}
        tooltip={tip}
        active={active}
        disabled={tool.disabled}
        onClick={() => onTool(tool.id)}
      />

      {flyout.showing && (
        <Flyout anchor={anchor} {...flyout.flyoutProps}>
          {tool.modes?.map(mode => (
            <MenuRow
              key={mode.id}
              label={t(mode.labelKey)}
              icon={mode.icon}
              shortcut={mode.shortcut}
              disabled={mode.disabled}
              checked={tool.activeMode === mode.id}
              tip={modeTip(
                t(mode.labelKey),
                mode.shortcut,
                mode.descriptionKey ? t(mode.descriptionKey) : undefined,
              )}
              onSelect={() => {
                onMode?.(tool.id, mode.id)
                flyout.close()
              }}
            />
          ))}
        </Flyout>
      )}
    </div>
  )
}
