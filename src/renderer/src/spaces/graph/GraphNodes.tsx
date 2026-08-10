import { memo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { NodeProps } from '@xyflow/react'
import type { GraphHandleInput, GraphHandleOutput, GraphNodeType } from '@shared/domain/graph'
import { isRecord } from '@shared/guards'
import {
  GRAPH_RUN_FAILURES,
  GRAPH_RUN_STATUSES,
  type GraphNodeRun,
  type GraphRunStatus,
} from '@/engines/graph/executor'
import type { StatusTone } from '@/design/ProgressRow'
import { cn } from '@/helpers/cn'
import { RUN_STATE_KEY } from './adapter'
import { NODE_LABEL_KEYS } from './node-labels'
import { InputPorts, OutputPorts } from './NodePorts'

/** How each state reads. The colour stays in the design system, as `ProgressRow` keeps it. */
const RUN_TONE: Record<GraphRunStatus, StatusTone> = {
  idle: 'muted',
  running: 'accent',
  cached: 'muted',
  done: 'success',
  failed: 'danger',
}

const TONE_CLASS: Record<StatusTone, string> = {
  muted: 'text-muted',
  accent: 'text-accent',
  success: 'text-success',
  danger: 'text-danger',
}

/**
 * What a node says about the run it is in, in the header where its type would otherwise sit.
 *
 * A failure names its own reason: "failed" alone sends the user to the jobs panel for a node that
 * never reached it — a loop, a missing model and a type this milestone cannot run yet all read
 * the same otherwise.
 */
function RunBadge({ run }: { run: GraphNodeRun }) {
  const { t } = useTranslation()
  if (run.status === 'idle') return null

  const key = run.status === 'failed' ? `graphRun.failure.${run.failure}` : `graphRun.${run.status}`

  return (
    <span role="status" className={cn('shrink-0 text-[10px]', TONE_CLASS[RUN_TONE[run.status]])}>
      {t(key)}
    </span>
  )
}

/** Home-made, like the whole dock: React Flow's own node carries hex values of its own. */
function NodeShell({
  title,
  kind,
  run,
  selected,
  inputs,
  outputs,
  children,
}: {
  title: string
  kind: string
  run: GraphNodeRun | undefined
  selected: boolean
  inputs: readonly GraphHandleInput[]
  outputs: readonly GraphHandleOutput[]
  children?: ReactNode
}) {
  return (
    <div
      className={cn(
        'bg-panel flex min-w-40 flex-col rounded-(--radius-sc-md) border',
        selected ? 'border-accent' : 'border-border',
      )}
    >
      <header className="border-border flex items-baseline justify-between gap-2 border-b px-2 py-1">
        <span className="truncate text-[11px]">{title}</span>
        {/* The run takes the corner while there is one to report: what a node is doing outranks
            what it is, and the two side by side crowd a header 40 px wide. */}
        {run && run.status !== 'idle' ? (
          <RunBadge run={run} />
        ) : (
          // Only when it says something the title does not: a node named after its own type would
          // otherwise read the same word twice, once translated and once not.
          kind !== title && <span className="text-muted shrink-0 text-[10px]">{kind}</span>
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
  inputHandles?: unknown
  outputHandles?: unknown
  /** Not `editorInfo` data: the adapter writes it on the way down — see `RUN_STATE_KEY`. */
  [RUN_STATE_KEY]?: unknown
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

/** The key naming a type, or the type itself — i18next hands a missing key straight back. */
const labelOf = (type: GraphNodeType): string => NODE_LABEL_KEYS[type] ?? type

/**
 * Memoised, like the rows of the collections: React Flow re-renders every mounted node on each
 * frame of a pan, and a graph is the one surface of the studio holding dozens of them at once.
 */
function nodeOf(
  name: string,
  drawn: GraphNodeType,
  body: (data: NodeData) => ReactNode,
): (props: NodeProps) => ReactNode {
  // Named per type rather than once for all three: without it React DevTools shows the same
  // component three times over, on the one surface where telling them apart is the point.
  const Node = ({ data, selected, type }: NodeProps): ReactNode => {
    const { t } = useTranslation()
    const fields: NodeData = data

    return (
      <NodeShell
        title={asText(fields.title) || t(labelOf(drawn))}
        kind={type}
        run={asRun(fields[RUN_STATE_KEY])}
        selected={selected === true}
        inputs={asHandles<GraphHandleInput>(fields.inputHandles)}
        outputs={asHandles<GraphHandleOutput>(fields.outputHandles)}
      >
        {body(fields)}
      </NodeShell>
    )
  }

  Object.defineProperty(Node, 'name', { value: name })
  return memo(Node)
}

const TextNode = nodeOf('TextNode', 'text', data => (
  <p className="text-muted line-clamp-3 text-[11px] whitespace-pre-wrap">{asText(data.value)}</p>
))

const AssetNode = nodeOf('AssetNode', 'asset', data => (
  <p className="text-muted truncate text-[11px]">{asText(data.value)}</p>
))

const ModelNode = nodeOf('ModelNode', 'model', data => (
  <p className="text-muted truncate text-[11px]">{asText(data.modelId)}</p>
))

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
      <p className="text-muted text-[11px] whitespace-pre-wrap">
        {value || t(labelOf('stickyNote'))}
      </p>
    </div>
  )
})

/**
 * Every type the editor does not draw yet: its name and its ports, which is all it takes to wire
 * one. A graph read from Scenario holds loops, conditions and approvals long before the editor
 * has a face for them — unlisted, React Flow falls back to a node of its own and warns on every
 * render, and the ports it would need to be wired by are simply not there.
 */
const PlainNode = memo(function PlainNode({ data, selected, type }: NodeProps) {
  const fields: NodeData = data

  return (
    <NodeShell
      title={asText(fields.title) || type}
      kind={type}
      run={asRun(fields[RUN_STATE_KEY])}
      selected={selected === true}
      inputs={asHandles<GraphHandleInput>(fields.inputHandles)}
      outputs={asHandles<GraphHandleOutput>(fields.outputHandles)}
    />
  )
})

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
  aspectRatio: PlainNode,
  modelInput: PlainNode,
  llm: PlainNode,
  transformText: PlainNode,
  splitText: PlainNode,
  ifElse: PlainNode,
  groupItems: PlainNode,
  sliceAssets: PlainNode,
  forEach: PlainNode,
  forEachEnd: PlainNode,
  approval: PlainNode,
}
