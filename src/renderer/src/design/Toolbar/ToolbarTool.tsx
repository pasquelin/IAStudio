import { useTranslation } from 'react-i18next'
import { HINT_RIGHT, type TooltipFactory } from '@/helpers/tooltip'
import { MenuButton } from '../MenuButton'
import { MenuRow, type MenuRowChoice } from '../MenuRow'
import type { ToolbarItem } from './tools'

export type ToolbarToolProps = {
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
export function ToolbarTool({ tool, active, tip, onTool, onMode }: ToolbarToolProps) {
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
