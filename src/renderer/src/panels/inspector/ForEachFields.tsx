import { mdiClose, mdiPlus } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import type { GraphNode, GraphState } from '@shared/domain/graph'
import { PropertyGroup } from '@/design/PropertyGroup'
import { PropertyRow } from '@/design/PropertyRow'
import { CONTROL } from '@/design/styles'
import { ToolButton } from '@/design/ToolButton'
import { setGraphNodeData, setGraphNodePorts } from '@/engines/graph/commands'
import {
  LOOP_LIST_KINDS,
  addedList,
  loopListsOf,
  loopsOf,
  namedLoopId,
  removedList,
  setListKind,
  type LoopListKind,
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
            aria-label={t('inspector.listKind')}
            value={list.kind}
            onChange={event => write(setListKind(node, list.index, kindOf(event.target.value)))}
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
          onClick={() => write(addedList(node, 'image'))}
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
 * The one field the end of a loop carries, and the one that decides whether the loop has a body
 * at all: without it the converter resolves every wire leaving the end to nothing, and compiles a
 * `for-each` that walks an empty body without a word of complaint.
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
        {withChosen(loopsOf(graph), chosen).map(loop => (
          <option key={loop.id} value={loop.id}>
            {loop.data.title ?? loop.id}
          </option>
        ))}
      </select>
    </PropertyRow>
  )
}

/** The named loop kept among the options whatever the graph holds — see the comment above. */
function withChosen(loops: readonly GraphNode[], chosen: string | undefined): readonly GraphNode[] {
  if (chosen === undefined || chosen === '' || loops.some(loop => loop.id === chosen)) return loops
  return [{ id: chosen, type: 'forEach', position: { x: 0, y: 0 }, data: {} }, ...loops]
}

/** The `<select>` hands back a string; only two of them name a kind the converter reads. */
const kindOf = (value: string): LoopListKind => (value === 'text' ? 'text' : 'image')
