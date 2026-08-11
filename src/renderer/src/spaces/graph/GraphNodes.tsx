import { mdiAlertCircleOutline, mdiExportVariant } from '@mdi/js'
import type { TFunction } from 'i18next'
import { memo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { NodeProps } from '@xyflow/react'
import {
  GRAPH_RUN_FAILURES,
  GRAPH_RUN_STATUSES,
  canBeOutput,
  type GraphHandleInput,
  type GraphHandleOutput,
  type GraphCondition,
  type GraphConditionBlock,
  type GraphNodeRun,
  type GraphNodeType,
  type GraphRunStatus,
} from '@shared/domain/graph'
import { isRecord } from '@shared/guards'
import { Button } from '@/design/Button'
import { TONE_TEXT, type StatusTone } from '@/design/styles'
import { UiIcon } from '@/design/UiIcon'
import { cn } from '@/helpers/cn'
import { HINT_BOTTOM } from '@/helpers/tooltip'
import { readConditionBlocks } from '@/engines/graph/conditions'
import { PROBLEM_KEY, RUN_STATE_KEY } from './adapter'
import { useNodeDecision } from './node-decision'
import { labelOf, titleOf } from './node-labels'
import { InputPorts, OutputPorts } from './NodePorts'

/** How each state reads. The colour itself stays in `design/styles.ts`, with the other tones. */
const RUN_TONE: Record<GraphRunStatus, StatusTone> = {
  idle: 'muted',
  // Muted, never accent: on a graph of twenty every node wears this at once, and an accent on all
  // of them would say twenty things are happening where at most a handful are.
  queued: 'muted',
  running: 'accent',
  awaiting: 'warning',
  cached: 'muted',
  done: 'success',
  // Muted, never danger: a branch nobody took is the graph working, not a node at fault.
  skipped: 'muted',
  failed: 'danger',
}

/**
 * The i18n key a run state reads under.
 *
 * A failure names its own REASON: "failed" alone sends the user to the jobs panel for a node that
 * never reached it — a loop, a missing model and a type this milestone cannot run yet all read
 * the same otherwise.
 */
export const runLabelKey = (run: GraphNodeRun): string =>
  run.status === 'failed' ? `graphRun.failure.${run.failure}` : `graphRun.${run.status}`

/**
 * No `role="status"` here, and that is the point: one per node meant twenty live regions on a
 * graph of twenty, all announcing at once. The canvas carries ONE, which says what changed last —
 * this badge is read by the eye, and by anyone walking the node.
 */
function RunBadge({ run }: { run: GraphNodeRun }) {
  const { t } = useTranslation()
  const key = runLabelKey(run)

  return <span className={cn('text-mini shrink-0', TONE_TEXT[RUN_TONE[run.status]])}>{t(key)}</span>
}

/** Home-made, like the whole dock: React Flow's own node carries hex values of its own. */
function NodeShell({
  title,
  kind,
  run,
  output,
  selected,
  problem,
  inputs,
  outputs,
  children,
}: {
  title: string
  kind: string
  run: GraphNodeRun | undefined
  /** Whether the compiler would start from this node — `isOutput`, where it is read. */
  output: boolean
  selected: boolean
  /** Whether the compiler's refusal points AT this node. The status line says which refusal. */
  problem: boolean
  inputs: readonly GraphHandleInput[]
  outputs: readonly GraphHandleOutput[]
  children?: ReactNode
}) {
  const { t } = useTranslation()

  return (
    <div
      className={cn(
        'bg-panel flex min-w-40 flex-col rounded-(--radius-sc-md) border',
        // Selection wins: it is the user's own pointing, and a node they just clicked must show
        // it. The refusal has the status line to say itself either way.
        selected ? 'border-accent' : problem ? 'border-danger' : 'border-border',
      )}
    >
      <header className="border-border flex items-baseline justify-between gap-2 border-b px-2 py-1">
        {/* The one node the compiler starts from. Marked on the face rather than in the inspector
            alone: which node an App ends on is read at a glance on the canvas, or not at all.
            Named as `AssetBadge` names its own marks — a glyph carries the meaning, so it needs
            the words a colour cannot give, and `UiIcon` is `aria-hidden` on every site. */}
        {/* The refusal, in words as well as in the border: the rule above applies to it too, and a
            red edge alone says nothing to a screen reader — which is the one place the status line
            beside the canvas cannot be reached from. */}
        {problem && (
          <span
            title={t('graphCompile.blamed')}
            aria-label={t('graphCompile.blamed')}
            role="img"
            className="text-danger shrink-0 self-center"
          >
            <UiIcon path={mdiAlertCircleOutline} size={12} />
          </span>
        )}
        {output && (
          <span
            title={t('inspector.isOutput')}
            aria-label={t('inspector.isOutput')}
            role="img"
            className="text-accent shrink-0 self-center"
          >
            <UiIcon path={mdiExportVariant} size={12} />
          </span>
        )}
        {/* `mr-auto` rather than the row's `justify-between`, which sent the title to the middle
            of the header the moment a third child appeared: two nodes side by side, one marked
            and one not, stopped lining their titles up. */}
        <span className="text-tiny mr-auto truncate">{title}</span>
        {/* The run takes the corner while there is one to report: the header holds a title that
            truncates and one thing beside it, and what a node is DOING outranks what it is. */}
        {run && run.status !== 'idle' ? (
          <RunBadge run={run} />
        ) : (
          // Only when it says something the title does not: a node named after its own type would
          // otherwise read the same word twice, once translated and once not.
          kind !== title && <span className="text-muted text-mini shrink-0">{kind}</span>
        )}
      </header>

      {children && <div className="px-2 py-1">{children}</div>}

      <div className="flex justify-between gap-4 px-1 py-2">
        <InputPorts handles={inputs} />
        <OutputPorts handles={outputs} />
      </div>
    </div>
  )
}

/** What every node reads off its own data, whatever else its type holds. */
type NodeData = {
  title?: unknown
  value?: unknown
  content?: unknown
  modelId?: unknown
  message?: unknown
  conditionBlocks?: unknown
  inputHandles?: unknown
  outputHandles?: unknown
  isOutput?: unknown
  /** Not `editorInfo` data: the adapter writes it on the way down — see `RUN_STATE_KEY`. */
  [RUN_STATE_KEY]?: unknown
  [PROBLEM_KEY]?: unknown
}

const asText = (value: unknown): string => (typeof value === 'string' ? value : '')

const asHandles = <T,>(value: unknown): readonly T[] => (Array.isArray(value) ? value : [])

/**
 * The run state the adapter put on the node, if any. Read through a guard like everything else
 * off `data`: React Flow types it as a free record, and a graph read off a file fills it too.
 */
function asRun(value: unknown): GraphNodeRun | undefined {
  if (!isRecord(value)) return undefined

  const status = GRAPH_RUN_STATUSES.find(known => known === value.status)
  if (status === undefined) return undefined
  if (status !== 'failed') return { status }

  const failure = GRAPH_RUN_FAILURES.find(known => known === value.failure)
  return failure ? { status, failure } : undefined
}

/**
 * Memoised, like the rows of the collections: React Flow re-renders every mounted node on each
 * frame of a pan, and a graph is the one surface of the studio holding dozens of them at once.
 */
function nodeOf(
  drawn: GraphNodeType,
  body: (data: NodeData, id: string) => ReactNode,
): (props: NodeProps) => ReactNode {
  // Named per type rather than once for all of them: without it React DevTools shows the same
  // component over and over, on the one surface where telling them apart is the point. Derived
  // from the type rather than passed beside it, so no node can be drawn under another's name.
  const name = `${drawn.charAt(0).toUpperCase()}${drawn.slice(1)}Node`
  const Node = ({ data, id, selected, type }: NodeProps): ReactNode => {
    const { t } = useTranslation()
    const fields: NodeData = data

    return (
      <NodeShell
        title={titleOf(fields, drawn, t)}
        kind={type}
        run={asRun(fields[RUN_STATE_KEY])}
        output={fields.isOutput === true && canBeOutput(drawn)}
        selected={selected === true}
        problem={fields[PROBLEM_KEY] === true}
        inputs={asHandles<GraphHandleInput>(fields.inputHandles)}
        outputs={asHandles<GraphHandleOutput>(fields.outputHandles)}
      >
        {body(fields, id)}
      </NodeShell>
    )
  }

  Object.defineProperty(Node, 'name', { value: name })
  return memo(Node)
}

const TextNode = nodeOf('text', data => (
  <p className="text-muted text-tiny line-clamp-3 whitespace-pre-wrap">{asText(data.value)}</p>
))

const AssetNode = nodeOf('asset', data => (
  <p className="text-muted text-tiny truncate">{asText(data.value)}</p>
))

const ModelNode = nodeOf('model', data => (
  <p className="text-muted text-tiny truncate">{asText(data.modelId)}</p>
))

/**
 * Its expression, in the type it is written in: a CEL expression is code, and reading one back in
 * the panel's own face makes a quoted string indistinguishable from a variable name.
 */
const TransformTextNode = nodeOf('transformText', data => (
  <p className="text-muted text-tiny line-clamp-3 font-mono break-all">{asText(data.value)}</p>
))

const ApprovalNode = nodeOf('approval', (data, id) => (
  <ApprovalBody id={id} message={asText(data.message)} run={asRun(data[RUN_STATE_KEY])} />
))

const IfElseNode = nodeOf('ifElse', data => (
  <IfElseBody blocks={readConditionBlocks(data.conditionBlocks)} />
))

/**
 * What each branch asks, in the order its output ports carry them — the first line leaves by the
 * first port, and so on down to the else.
 *
 * Read on the face rather than in the inspector alone: which way a graph forks is the one thing
 * about it that cannot be worked out from the wires, and a node showing only its ports would have
 * the user click each one to find out what it tests.
 */
function IfElseBody({ blocks }: { blocks: readonly GraphConditionBlock[] }) {
  const { t } = useTranslation()

  if (blocks.length === 0) {
    return <p className="text-muted text-tiny">{t('graph.noConditions')}</p>
  }

  return (
    <ul className="flex flex-col gap-2">
      {blocks.map((block, index) => (
        <li key={index} className="text-muted text-tiny truncate">
          {block.conditions
            .map(condition => readableCondition(condition, t))
            .join(` ${t(`graph.logic.${block.logic}`)} `)}
        </li>
      ))}
    </ul>
  )
}

/**
 * One condition as a line — outside the component, which is the rule of this file: React Flow
 * re-renders every mounted node on each frame of a pan, and a closure rebuilt per render is one
 * per node per frame.
 */
const readableCondition = (condition: GraphCondition, t: TFunction): string =>
  [
    condition.field ?? t('graph.noField'),
    t(`graph.condition.${condition.operator}`),
    Array.isArray(condition.value) ? condition.value.join('…') : (condition.value ?? ''),
  ]
    .filter(part => part !== '')
    .join(' ')

/**
 * The question an approval puts, and the two answers to it while a run is stopped on it.
 *
 * The buttons are drawn only while the run is `awaiting`: an approval node standing on an idle
 * canvas is a gate someone will pass through later, not a decision to take now — and answering
 * one nobody asked would be a click into `decide`, which drops it.
 */
function ApprovalBody({
  id,
  message,
  run,
}: {
  id: string
  message: string
  run: GraphNodeRun | undefined
}) {
  const { t } = useTranslation()
  const decide = useNodeDecision()

  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted text-tiny line-clamp-3 whitespace-pre-wrap">
        {message || t('graph.askApproval')}
      </p>

      {run?.status === 'awaiting' && (
        // `nodrag`, or React Flow swallows the press to start dragging the node and the button
        // never fires — its own escape hatch, and the only way a control lives inside a node.
        <div className="nodrag flex gap-2">
          <Button
            variant="primary"
            onClick={() => decide(id, true)}
            {...HINT_BOTTOM(t('graph.approveHint'))}
          >
            {t('graph.approve')}
          </Button>
          <Button onClick={() => decide(id, false)} {...HINT_BOTTOM(t('graph.declineHint'))}>
            {t('graph.decline')}
          </Button>
        </div>
      )}
    </div>
  )
}

/**
 * A note, and the only node with no execution at all: the compiler's own union does not carry
 * it. Its own colour rather than the panel's, because it is the one thing on the canvas that is
 * not part of the graph.
 */
const StickyNoteNode = memo(function StickyNoteNode({ data, selected }: NodeProps) {
  const { t } = useTranslation()
  const fields: NodeData = data
  // `content`, which is what Scenario writes; `value` is the field the text and asset nodes use.
  const value = asText(fields.content)

  return (
    <div
      className={cn(
        'bg-surface min-h-16 min-w-40 rounded-(--radius-sc-md) border px-2 py-1',
        selected ? 'border-accent' : 'border-border',
      )}
    >
      <p className="text-muted text-tiny whitespace-pre-wrap">
        {value || t(labelOf('stickyNote'))}
      </p>
    </div>
  )
})

/**
 * Every type the editor draws by its name and its ports alone, which is all it takes to wire one.
 * A graph read from Scenario holds loops, conditions and approvals long before the editor has a
 * face for them — unlisted, React Flow falls back to a node of its own and warns on every render,
 * and the ports it would need to be wired by are simply not there.
 *
 * Through `nodeOf` rather than one shared component reading its own `type`: the type is then known
 * at build time, so the name it is drawn under is looked up exactly as the drawn types look theirs
 * up, and DevTools tells the eight apart.
 *
 * The component's name is DERIVED from the type rather than passed beside it: written twice, one
 * of the eight would sooner or later be drawn under another's label, and nothing would compile
 * differently.
 */
const plainNode = (drawn: GraphNodeType): ((props: NodeProps) => ReactNode) =>
  nodeOf(drawn, () => null)

/**
 * Declared once, outside any component: React Flow remounts every node when this object changes
 * identity, which on a graph of any size is a frame lost per render.
 *
 * A `Record` over the whole union, so a sixteenth node type is a compile error here rather than
 * a node nobody can see.
 */
export const GRAPH_NODE_TYPES: Record<GraphNodeType, (props: NodeProps) => ReactNode> = {
  text: TextNode,
  asset: AssetNode,
  model: ModelNode,
  stickyNote: StickyNoteNode,
  aspectRatio: plainNode('aspectRatio'),
  modelInput: plainNode('modelInput'),
  llm: plainNode('llm'),
  transformText: TransformTextNode,
  splitText: plainNode('splitText'),
  ifElse: IfElseNode,
  groupItems: plainNode('groupItems'),
  sliceAssets: plainNode('sliceAssets'),
  forEach: plainNode('forEach'),
  forEachEnd: plainNode('forEachEnd'),
  approval: ApprovalNode,
}
