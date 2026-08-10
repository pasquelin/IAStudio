import { mdiClose, mdiPlus } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import type { GraphNode, GraphState } from '@shared/domain/graph'
import { PropertyGroup } from '@/design/PropertyGroup'
import { PropertyRow } from '@/design/PropertyRow'
import { CONTROL } from '@/design/styles'
import { ToolButton } from '@/design/ToolButton'
import { setGraphNodeData, setGraphNodePorts } from '@/engines/graph/commands'
import {
  DEFAULT_LIST_KIND,
  LOOP_LIST_KINDS,
  addedList,
  isLoopListKind,
  loopListsOf,
  loopsOf,
  namedLoopId,
  removedList,
  setListKind,
  type LoopPatch,
} from '@/engines/graph/loops'
import { cn } from '@/helpers/cn'
import { TIP_LEFT } from '@/helpers/tooltip'
import { graphOf, useGraphs } from '@/stores/graphs'
import type { DocumentEdit } from './useDocumentEdit'

export type ForEachFieldsProps = {
  node: GraphNode
  edit: DocumentEdit<GraphState>
}

/**
 * The lists a loop walks, one row each — and a loop's lists live in its PORTS, not in its `data`.
 *
 * A kind rather than a free type: the converter names the flow input and the item of the
 * iteration `text${n}` or `image${n}` and knows no third word, so anything else would be a
 * variable the server has never been told about.
 */
export function ForEachFields({ node, edit }: ForEachFieldsProps) {
  const { t } = useTranslation()
  const lists = loopListsOf(node)

  /**
   * The two sides move together, in one command.
   *
   * The pairing is the NUMBER the two ports share — the converter reads it off the id, never off
   * the position — so a patch that touched one side alone would leave a list coming in with no
   * item going out, and an undo splitting the two would do it silently.
   */
  const write = (patch: LoopPatch): void => {
    edit.run(setGraphNodePorts(node.id, patch))
  }

  return (
    <PropertyGroup title={t('inspector.lists')}>
      {lists.map(list => (
        <PropertyRow key={list.index} label={t('inspector.list', { number: list.index + 1 })}>
          <select
            aria-label={t('inspector.listContents')}
            value={list.kind}
            onChange={event =>
              isLoopListKind(event.target.value) &&
              write(setListKind(node, list.index, event.target.value))
            }
            className={cn(CONTROL, 'min-w-0 flex-1 px-1')}
          >
            {LOOP_LIST_KINDS.map(kind => (
              <option key={kind} value={kind}>
                {t(`graph.listKind.${kind}`)}
              </option>
            ))}
          </select>
          <ToolButton
            icon={mdiClose}
            label={t('inspector.removeList')}
            tooltip={TIP_LEFT}
            variant="header"
            onClick={() => write(removedList(node, list.index))}
          />
        </PropertyRow>
      ))}

      <PropertyRow label={t('inspector.addListRow')}>
        <ToolButton
          icon={mdiPlus}
          label={t('inspector.addList')}
          tooltip={TIP_LEFT}
          variant="header"
          onClick={() => write(addedList(node, DEFAULT_LIST_KIND))}
        />
      </PropertyRow>
    </PropertyGroup>
  )
}

export type ForEachEndFieldsProps = {
  documentId: string
  node: GraphNode
  edit: DocumentEdit<GraphState>
}

/**
 * The one field the end of a loop carries, and the one that pairs it with its `forEach`: the
 * converter walks the body between the two, and resolves every wire leaving the end to the loop.
 * Without it the loop compiles with an empty body, which the SDK's validator refuses.
 */
export function ForEachEndFields({ documentId, node, edit }: ForEachEndFieldsProps) {
  const { t } = useTranslation()
  const graph = useGraphs(state => graphOf(state, documentId))
  const chosen = namedLoopId(node)

  return (
    <PropertyRow label={t('inspector.loop')}>
      <select
        aria-label={t('inspector.loop')}
        value={chosen ?? ''}
        onChange={event =>
          edit.run(setGraphNodeData(node.id, { parentNodeId: event.target.value }))
        }
        className={cn(CONTROL, 'min-w-0 flex-1 px-1')}
      >
        {/* An end naming no loop lands here. One naming a loop since DELETED does not: `withChosen`
            keeps it among the options, as `IfElseFields` keeps a deleted field and
            `ModelFamilySettings` a stored model — a `<select>` whose value matches no option
            renders blank, and the panel would read "no loop" over an end that names one. */}
        <option value="">{t('graph.noLoop')}</option>
        {withChosen(loopsOf(graph).map(nameOf), chosen).map(loop => (
          <option key={loop.value} value={loop.value}>
            {loop.label}
          </option>
        ))}
      </select>
    </PropertyRow>
  )
}

type LoopOption = { value: string; label: string }

/**
 * `||` rather than `??`, as the canvas names a node: emptying the title field writes `''`, and a
 * nullish check would then legend the option with nothing at all — the very blank the picker
 * below is written to avoid.
 */
const nameOf = (loop: GraphNode): LoopOption => ({
  value: loop.id,
  label: loop.data.title || loop.id,
})

/** The named loop kept among the options whatever the graph holds — see the comment above. */
function withChosen(
  loops: readonly LoopOption[],
  chosen: string | undefined,
): readonly LoopOption[] {
  // No `chosen === ''` test: `namedLoopId` collapses the empty string the picker writes into
  // `undefined`, so there is one spelling of "no loop" to answer here rather than two.
  if (chosen === undefined || loops.some(loop => loop.value === chosen)) return loops
  return [{ value: chosen, label: chosen }, ...loops]
}
