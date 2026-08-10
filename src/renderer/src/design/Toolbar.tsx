import { mdiRedo, mdiUndo } from '@mdi/js'
import { Fragment, type CSSProperties, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/helpers/cn'
import { MenuButton } from './MenuButton'
import { MenuRow, type MenuRowChoice } from './MenuRow'
import { Separator } from './Separator'
import { HINT_RIGHT, tipFor, type TooltipFactory } from '@/helpers/tooltip'
import { ToolButton } from './ToolButton'

export type ToolMode = {
  id: string
  /** i18n key of the label — never the displayed text. */
  labelKey: string
  /**
   * i18n key of the one-line tooltip. Required: a mode's label is on screen inside its row, so
   * the tooltip is the only thing that can say more than the label already does.
   */
  descriptionKey: string
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
  /** A toggle that is on. Distinct from `activeTool`, the one armed tool, and drawn alike. */
  pressed?: boolean
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
  /** What no class can express — an offset read off a runtime measure, such as the rulers'. */
  style?: CSSProperties
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
  style,
}: ToolbarProps) {
  const { t } = useTranslation()
  const vertical = orientation === 'vertical'
  // A vertical bar hugs the left edge, so its tooltips go right — placed on top they would sit
  // over the button above and cover the tool the eye is comparing against.
  const tip = tipFor(orientation)
  const divider = <Separator orientation={vertical ? 'horizontal' : 'vertical'} />

  return (
    <div
      role="toolbar"
      style={style}
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
            // Either, never one overriding the other: `pressed: false` on the armed tool must
            // not draw it released.
            active={tool.pressed === true || tool.id === activeTool}
            tip={tip}
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
  onTool: (id: string) => void
  onMode?: (toolId: string, modeId: string) => void
}

/**
 * A tool and, when it has several, its modes. Taken from map3D's `EraseToolButton`: the button
 * always acts on click, and the flyout only offers to switch mode — so an armed tool never
 * needs the menu to be reachable.
 */
function ToolItem({ tool, active, tip, onTool, onMode }: ToolItemProps) {
  const { t } = useTranslation()

  // The button wears the armed mode's icon: a shapes tool armed with the ellipse has to look
  // like an ellipse, or the bar stops saying what the next click will draw.
  const armed = tool.modes?.find(mode => mode.id === tool.activeMode)
  const description = armed?.descriptionKey ?? tool.descriptionKey

  return (
    <MenuButton
      icon={armed?.icon ?? tool.icon}
      label={t(armed?.labelKey ?? tool.labelKey)}
      description={description ? t(description) : undefined}
      // No `??` onto the tool's own: a group's shortcut belongs to its first mode, and
      // showing it on another one contradicts the menu row right below.
      shortcut={tool.modes ? armed?.shortcut : tool.shortcut}
      tooltip={tip}
      active={active}
      disabled={tool.disabled}
      rowCount={tool.modes?.length ?? 0}
      // A group with no armed mode is a menu of actions, not a choice of tool: nothing is
      // armed by clicking it, so the click has to open what hovering would have.
      opensOnClick={tool.modes !== undefined && tool.activeMode === undefined}
      onClick={() => onTool(tool.id)}
      rows={close =>
        tool.modes?.map(mode => {
          // The same distinction the `opensOnClick` line above makes: a group with no armed mode
          // is a menu of ACTIONS — Add a cube, add a light — and its rows answer no question.
          // Ticked as alternatives they would all announce "radio, not selected", which says one
          // of them is armed when none of them can be.
          const choice: MenuRowChoice =
            tool.activeMode === undefined
              ? {}
              : { checked: tool.activeMode === mode.id, tick: 'one-of' }

          return (
            <MenuRow
              key={mode.id}
              label={t(mode.labelKey)}
              icon={mode.icon}
              shortcut={mode.shortcut}
              disabled={mode.disabled}
              {...choice}
              // `HINT_*`, not the bar's own factory: a row shows its label and its shortcut, so
              // an `aria-label` here would replace a visible name (WCAG 2.5.3).
              tip={HINT_RIGHT(t(mode.descriptionKey))}
              onSelect={() => {
                onMode?.(tool.id, mode.id)
                close()
              }}
            />
          )
        })
      }
    />
  )
}
