import { mdiClose, mdiPlus } from '@mdi/js'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  CONDITION_LOGICS,
  GRAPH_CONDITION_OPERATORS,
  conditionArity,
  isGraphConditionOperator,
  type GraphCondition,
  type GraphConditionBlock,
  type GraphNode,
  type GraphState,
} from '@shared/domain/graph'
import { PropertyGroup } from '@/design/PropertyGroup'
import { PropertyRow } from '@/design/PropertyRow'
import { CONTROL, FIELD } from '@/design/styles'
import { ToolButton } from '@/design/ToolButton'
import { setGraphNodePorts, setGraphNodeData } from '@/engines/graph/commands'
import {
  addCondition,
  addedBranch,
  conditionBlocksOf,
  conditionFieldsOf,
  removeCondition,
  removedBranch,
  setBlockLogic,
  setCondition,
  type BranchPatch,
} from '@/engines/graph/conditions'
import { cn } from '@/helpers/cn'
import { TIP_LEFT } from '@/helpers/tooltip'
import { graphOf, useGraphs } from '@/stores/graphs'
import type { DocumentEdit } from './useDocumentEdit'

export type IfElseFieldsProps = {
  documentId: string
  node: GraphNode
  edit: DocumentEdit<GraphState>
}

/**
 * What a branch asks, and which of its outputs the answer leaves by.
 *
 * A query builder rather than an expression to type: the CEL is Scenario's to write — the
 * converter compiles one per block — and a field here that let someone type it would be a second
 * dialect of a language only the server runs.
 */
export function IfElseFields({ documentId, node, edit }: IfElseFieldsProps) {
  const { t } = useTranslation()
  const graph = useGraphs(state => graphOf(state, documentId))
  const blocks = conditionBlocksOf(node)
  // Derived here rather than in the selector: a fresh array out of one is a new snapshot on every
  // read, which `useSyncExternalStore` treats as a change that has not settled.
  const fields = useMemo(() => conditionFieldsOf(graph, node.id), [graph, node.id])

  /**
   * Editing what a branch ASKS leaves its ports strictly alone.
   *
   * The node's handles may be a file's own — the converter matches an `ifElse` port by its index,
   * never by its spelling — so rewriting them on a changed value would rename ports nobody
   * touched and cut every wire into them.
   */
  const write = (next: readonly GraphConditionBlock[]): void => {
    edit.run(setGraphNodeData(node.id, { conditionBlocks: next }))
  }

  /**
   * Adding or dropping a branch moves BOTH halves at once, in one command.
   *
   * A block is a position: the converter gives block `i` the case value `i + 2` and reads every
   * port past the last block as the else. Given back apart by an undo, the else would answer for
   * a branch — so the two are one entry in the history, never two.
   */
  const writeBranches = (patch: BranchPatch): void => {
    edit.run(setGraphNodePorts(node.id, patch))
  }

  return (
    <PropertyGroup title={t('inspector.conditions')}>
      {blocks.map((block, index) => (
        <div key={index} className="border-border border-b py-1 last:border-b-0">
          <PropertyRow label={t('inspector.branch', { number: index + 1 })}>
            <ToolButton
              icon={mdiClose}
              label={t('inspector.removeBranch')}
              tooltip={TIP_LEFT}
              variant="header"
              onClick={() => writeBranches(removedBranch(node, index))}
            />
          </PropertyRow>

          {block.conditions.map((condition, at) => (
            <ConditionRow
              key={at}
              condition={condition}
              fields={fields}
              // Shown from the second row on, where it is what the row above and this one do
              // together; on a single condition it would be a choice with no second operand.
              logic={at === 0 ? undefined : block.logic}
              onLogic={logic => write(setBlockLogic(blocks, index, logic))}
              onChange={patch => write(setCondition(blocks, index, at, patch))}
              onRemove={() => write(removeCondition(blocks, index, at))}
              gesture={edit.gesture}
            />
          ))}

          <ToolButton
            icon={mdiPlus}
            label={t('inspector.addCondition')}
            tooltip={TIP_LEFT}
            variant="header"
            onClick={() => write(addCondition(blocks, index))}
          />
        </div>
      ))}

      {/* Named for what it produces rather than for the gesture: an added block is an output the
          canvas grows, and the else moves down one. */}
      <PropertyRow label={t('inspector.otherwise')}>
        <ToolButton
          icon={mdiPlus}
          label={t('inspector.addBranch')}
          tooltip={TIP_LEFT}
          variant="header"
          onClick={() => writeBranches(addedBranch(node))}
        />
      </PropertyRow>
    </PropertyGroup>
  )
}

function ConditionRow({
  condition,
  fields,
  logic,
  onLogic,
  onChange,
  onRemove,
  gesture,
}: {
  condition: GraphCondition
  fields: readonly string[]
  logic: GraphConditionBlock['logic'] | undefined
  onLogic: (logic: GraphConditionBlock['logic']) => void
  onChange: (patch: Partial<GraphCondition>) => void
  onRemove: () => void
  gesture: DocumentEdit<GraphState>['gesture']
}) {
  const { t } = useTranslation()
  const arity = conditionArity(condition.operator)
  const pair = Array.isArray(condition.value) ? condition.value : []

  return (
    <div className="flex flex-col gap-2 py-1">
      {logic !== undefined && (
        <select
          aria-label={t('inspector.combine')}
          value={logic}
          onChange={event => onLogic(event.target.value === 'or' ? 'or' : 'and')}
          className={cn(CONTROL, 'w-full px-1')}
        >
          {CONDITION_LOGICS.map(value => (
            <option key={value} value={value}>
              {t(`graph.logic.${value}`)}
            </option>
          ))}
        </select>
      )}

      <div className="flex items-center gap-2">
        <select
          aria-label={t('inspector.conditionField')}
          value={condition.field ?? ''}
          onChange={event => onChange({ field: event.target.value })}
          className={cn(CONTROL, 'min-w-0 flex-1 px-1')}
        >
          {/* A branch wired to nothing lands here — and so does one whose condition names a node
              since deleted, or names it in the `<id>_<handle>` form the converter also accepts.
              `withChosen` below is what keeps that second case visible: an option list that does
              not hold the value renders BLANK, over a condition that does test something. */}
          <option value="">{t('graph.noField')}</option>
          {withChosen(fields, condition.field).map(field => (
            <option key={field} value={field}>
              {field}
            </option>
          ))}
        </select>

        <select
          aria-label={t('inspector.conditionOperator')}
          value={condition.operator}
          onChange={event =>
            isGraphConditionOperator(event.target.value) &&
            onChange({ operator: event.target.value })
          }
          className={cn(CONTROL, 'min-w-0 flex-1 px-1')}
        >
          {GRAPH_CONDITION_OPERATORS.map(operator => (
            <option key={operator} value={operator}>
              {t(`graph.condition.${operator}`)}
            </option>
          ))}
        </select>

        <ToolButton
          icon={mdiClose}
          label={t('inspector.removeCondition')}
          tooltip={TIP_LEFT}
          variant="header"
          onClick={onRemove}
        />
      </div>

      {arity === 'one' && (
        <ValueInput
          label={t('inspector.conditionValue')}
          value={typeof condition.value === 'string' ? condition.value : ''}
          onChange={value => onChange({ value })}
          gesture={gesture}
        />
      )}

      {arity === 'range' && (
        <div className="flex items-center gap-2">
          {/* Both halves written at once: `between` compiles to `false` unless it holds a pair, so
              a field left alone would be a branch that reads complete and never fires. */}
          <ValueInput
            label={t('inspector.rangeFrom')}
            value={pair[0] ?? ''}
            onChange={value => onChange({ value: [value, pair[1] ?? ''] })}
            gesture={gesture}
          />
          <ValueInput
            label={t('inspector.rangeTo')}
            value={pair[1] ?? ''}
            onChange={value => onChange({ value: [pair[0] ?? '', value] })}
            gesture={gesture}
          />
        </div>
      )}
    </div>
  )
}

/**
 * The chosen field kept among the options whatever the wires say — as `ModelFamilySettings` keeps
 * the stored model among its own, and for the very same reason: a `<select>` whose value matches
 * no option has `selectedIndex === -1` and renders blank, so the panel would read "nothing is
 * tested" over a condition that tests something, and the next stray change would overwrite it
 * unseen.
 */
function withChosen(fields: readonly string[], chosen: string | undefined): readonly string[] {
  if (chosen === undefined || chosen === '' || fields.includes(chosen)) return fields
  return [chosen, ...fields]
}

/**
 * A value with no label beside it, which is what sets it apart from `TextField`: the row above
 * already says what is being compared, and a second label per condition would double the height
 * of a branch holding three.
 */
function ValueInput({
  label,
  value,
  onChange,
  gesture,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  gesture: DocumentEdit<GraphState>['gesture']
}) {
  return (
    <input
      type="text"
      aria-label={label}
      value={value}
      onChange={event => onChange(event.target.value)}
      // One entry per session at the field, not one per keystroke — as `TextField` does it.
      onFocus={() => gesture.onGestureStart()}
      onBlur={() => gesture.onGestureEnd()}
      className={cn(FIELD, 'min-w-0 flex-1 text-[11px]')}
    />
  )
}
