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
  // A group of SEVERAL rows with no armed mode is a menu of ACTIONS — Add a cube, Regenerate:
  // its click opens what hovering would have, and arms nothing. Several, because `useHoverFlyout`
  // opens nothing under two rows — one row and no armed mode would be a button doing neither.
  const opensOnClick = (tool.modes?.length ?? 0) > 1 && tool.activeMode === undefined

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
      // An armed tool is something one ACTIONS, which `CLAUDE.md` gives the full accent — and
      // `active` alone paints it `elevated`, the very colour the hover uses. The bar then said
      // the same thing about the tool under the pointer and the tool in the hand.
      accented={active}
      // A menu of actions acts too, whether or not its registry says so: none of its rows can be
      // armed, so the button it opens from has no pressed state either.
      acts={tool.acts === true || opensOnClick}
      disabled={tool.disabled}
      rowCount={tool.modes?.length ?? 0}
      opensOnClick={opensOnClick}
      onClick={opensOnClick ? undefined : () => onTool(tool.id)}
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
