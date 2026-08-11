import { Handle, Position, type HandleType } from '@xyflow/react'
import type { GraphHandleInput, GraphHandleOutput } from '@shared/domain/graph'
import { acceptedTypes } from '@/engines/graph/handles'
import { cn } from '@/helpers/cn'
import { useModelText } from '@/hooks/useModelText'

/**
 * Where each side of a port goes, and why it reads backwards.
 *
 * Scenario points an edge from the CONSUMER to the PROVIDER, so in React Flow's own vocabulary
 * an INPUT — on the left — is a handle of type `source`, and an OUTPUT — on the right — is a
 * handle of type `target`. The published Apps say the same: `sourcePosition: 'left'`,
 * `targetPosition: 'right'` on every node. Swap the two and every export is reversed, with no
 * error and no warning.
 */
const INPUT_HANDLE: HandleType = 'source'
const OUTPUT_HANDLE: HandleType = 'target'

type Say = (text: string) => string

/**
 * A port shows the name the workflow gave it, said in the studio's language. Failing a name it
 * shows what it accepts — and a type is left alone: `image` is what the connection check reads,
 * and a translated one would no longer match the type printed on the port across the edge.
 */
const labelOf = (handle: GraphHandleInput, say: Say): string => {
  const named = handle.label ?? handle.name
  return named ? say(named) : acceptedTypes(handle).join(' · ')
}

/** An output names itself or says what it makes; a port that declares neither draws nothing. */
const outputLabelOf = (handle: GraphHandleOutput, say: Say): string =>
  handle.name ? say(handle.name) : (handle.type ?? '')

const PORT = 'size-2 rounded-full border'

export function InputPorts({ handles }: { handles: readonly GraphHandleInput[] }) {
  const say = useModelText()

  return (
    <ul className="flex flex-col gap-2">
      {handles.map(handle => (
        <li key={handle.id} className="relative flex items-center gap-2 pl-1">
          <Handle
            id={handle.id}
            type={INPUT_HANDLE}
            position={Position.Left}
            className={cn(PORT, 'border-border bg-surface')}
          />
          <span className="text-muted text-mini truncate">{labelOf(handle, say)}</span>
        </li>
      ))}
    </ul>
  )
}

export function OutputPorts({ handles }: { handles: readonly GraphHandleOutput[] }) {
  const say = useModelText()

  return (
    <ul className="flex flex-col items-end gap-2">
      {handles.map(handle => (
        <li key={handle.id} className="relative flex items-center gap-2 pr-1">
          <span className="text-muted text-mini truncate">{outputLabelOf(handle, say)}</span>
          <Handle
            id={handle.id}
            type={OUTPUT_HANDLE}
            position={Position.Right}
            className={cn(PORT, 'border-accent bg-accent-soft')}
          />
        </li>
      ))}
    </ul>
  )
}
