import { mdiPlus } from '@mdi/js'
import { kindForWorkspace } from '@shared/domain/document'
import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { Separator } from '@/design/Separator'
import { TIP_RIGHT } from '@/helpers/tooltip'
import { ToolButton } from '@/design/ToolButton'
import { useLayouts } from '@/stores/layouts'
import { useProject } from '@/stores/project'
import { useTools } from '@/stores/tools'
import { createDocumentIn } from './new-document'
import { TOOL_SLOTS, type ToolSlot, type ToolZone } from '@shared/domain/tool'
import {
  shownTool,
  toolTitleKey,
  useAvailableTools,
  useHasModel,
  type Tool,
} from '@/helpers/tool-registry'

export type RailProps = {
  /** Edge the rail sticks to. The left rail also carries the bottom strip's tools. */
  side: 'left' | 'right'
}

const ZONES_BY_SIDE: Record<'left' | 'right', { top: ToolZone[]; bottom: ToolZone[] }> = {
  left: { top: ['left', 'top'], bottom: ['bottom'] },
  right: { top: ['right'], bottom: [] },
}

/**
 * An edge's icon rail, IDE-style: it stays in place when the zone is closed, so a closed tool
 * is always one click away. "View ▸ Tool windows" in the native menu is the second way back.
 *
 * The left rail is split into two groups — left-column tools at the top, bottom-strip tools
 * at the bottom — so that an icon's position tells where the tool will open.
 */
export function Rail({ side }: RailProps) {
  const { top, bottom } = ZONES_BY_SIDE[side]

  return (
    <div
      role="toolbar"
      aria-orientation="vertical"
      className="flex w-(--sc-rail) shrink-0 flex-col items-center justify-between py-(--sc-gutter)"
    >
      <div className="flex flex-col items-center gap-2">
        {side === 'left' && (
          <>
            <NewDocumentButton />
            <Separator orientation="horizontal" />
          </>
        )}
        {top.map(zone => (
          <RailGroup key={zone} zone={zone} />
        ))}
      </div>
      {bottom.map(zone => (
        <RailGroup key={zone} zone={zone} />
      ))}
    </div>
  )
}

/**
 * Above the tool icons rather than in the Explorer header: it stays reachable when every panel
 * is closed. Disabled — not hidden — where no editor exists yet: a button that vanishes reads
 * as a display bug.
 */
function NewDocumentButton() {
  const { t } = useTranslation()
  const workspace = useLayouts(state => state.activeWorkspace)
  // A document is a file in a project folder: with no project open there is nowhere to write it,
  // and the create would fail after the click rather than before it.
  const project = useProject(state => state.project)

  return (
    <ToolButton
      icon={mdiPlus}
      iconSize={22}
      label={t('documents.new')}
      tooltip={TIP_RIGHT}
      disabled={kindForWorkspace(workspace) === null || !project}
      onClick={() => createDocumentIn(workspace)}
      // Filled, unlike every tool icon around it: this one acts, the others only switch what is
      // shown. A grey plus among grey glyphs is a plus nobody finds.
      className="bg-create hover:bg-create-hover size-(--sc-rail-button) rounded-(--radius-sc-md) text-white hover:text-white disabled:bg-transparent disabled:text-current"
    />
  )
}

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
function RailGroup({ zone }: { zone: ToolZone }) {
  const { t } = useTranslation()
  // Reading the store here rather than receiving props keeps a rail click from re-rendering
  // the Shell — and with it the Dockview host at the center.
  const focusedZone = useTools(state => state.focusedZone)
  const workspace = useLayouts(state => state.activeWorkspace)
  const open = useTools(state => state.open)
  const hasModel = useHasModel(workspace)
  const tools = useAvailableTools(zone, workspace)
  // Actions are stable for the store's lifetime: subscribing to them would only add selectors
  // re-run on every write.
  const { show, close } = useTools.getState()

  return (
    <div className="flex flex-col items-center gap-2">
      {halvesOf(tools).map(([slot, inSlot], index) => {
        // What the half draws, not what it stores: a panel standing in for one this section
        // puts elsewhere is up, and its icon has to read — and close — as up.
        const up = shownTool(open[zone]?.[slot], zone, slot, workspace, hasModel)

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
                  onClick={() => (isOpen ? close(zone, slot) : show(zone, tool.id))}
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
