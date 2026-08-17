import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { Separator } from '@/design/Separator'
import { TIP_RIGHT } from '@/helpers/tooltip'
import { ToolButton } from '@/design/ToolButton'
import { useToolSurface } from '@/stores/layouts'
import { arrangementOf, useTools } from '@/stores/tools'
import { TOOL_SLOTS, type ToolSlot, type ToolZone } from '@shared/domain/tool'
import {
  shownTool,
  toolTitleKey,
  useAvailableTools,
  useToolState,
  type Tool,
} from '@/helpers/toolRegistry'

/** The zone's populated halves, in order. Empty ones never reach the rail. */
function halvesOf(tools: Tool[]): [ToolSlot, Tool[]][] {
  return TOOL_SLOTS.map((slot): [ToolSlot, Tool[]] => [
    slot,
    tools.filter(tool => tool.slot === slot),
  ]).filter(([, inSlot]) => inSlot.length > 0)
}

/**
 * The zone's tools, cut the way the zone itself is cut: the icons above the separator open in
 * its first half, the ones below in its second. On the right that cut separates what shows the
 * document from what edits the selection. The rail is the legend of the column.
 *
 * One zone per group rather than a list: `useAvailableTools` is a hook, and the generator's
 * presence depends on state — a loop over zones could not ask it.
 */
export function RailGroup({ zone }: { zone: ToolZone }) {
  const { t } = useTranslation()
  // Reading the store here rather than receiving props keeps a rail click from re-rendering
  // the Shell — and with it the Dockview host at the center.
  const focusedZone = useTools(state => state.focusedZone)
  const surface = useToolSurface()
  const open = useTools(state => arrangementOf(state, surface).open)
  const state = useToolState(surface)
  const tools = useAvailableTools(zone, surface)
  // Actions are stable for the store's lifetime: subscribing to them would only add selectors
  // re-run on every write.
  const { show, close } = useTools.getState()

  // The rule `halvesOf` makes for halves, applied to the group itself: an empty flex child still
  // eats one of the rail's gaps, and the home's left rail has two such zones — a hole where its
  // icons used to be. No surface declares a `top` placement at all.
  if (tools.length === 0) return null

  return (
    <div className="flex flex-col items-center gap-2">
      {halvesOf(tools).map(([slot, inSlot], index) => {
        // What the half draws, not what it stores: a panel standing in for one this section
        // puts elsewhere is up, and its icon has to read — and close — as up.
        const up = shownTool(open[zone]?.[slot], zone, slot, surface, state)

        return (
          <Fragment key={`${zone}:${slot}`}>
            {/* Only between two populated halves: a lone group has nothing to be cut from. */}
            {index > 0 && <Separator orientation="horizontal" />}

            {inSlot.map(tool => {
              const isOpen = up === tool.id
              return (
                <ToolButton
                  key={tool.id}
                  icon={tool.icon}
                  iconSize={22}
                  label={t(toolTitleKey(tool.id))}
                  tooltip={TIP_RIGHT}
                  active={isOpen}
                  accented={isOpen && focusedZone === zone}
                  onClick={() =>
                    isOpen ? close(surface, zone, slot) : show(surface, zone, tool.id)
                  }
                  className="size-(--sc-rail-button) rounded-(--radius-sc-md)"
                />
              )
            })}
          </Fragment>
        )
      })}
    </div>
  )
}
