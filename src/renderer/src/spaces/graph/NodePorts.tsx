import { Handle, Position, type HandleType } from '@xyflow/react'
import type { GraphHandleInput, GraphHandleOutput } from '@shared/domain/graph'
import { acceptedTypes } from '@/engines/graph/handles'
import { cn } from '@/helpers/cn'

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

/** A polymorphic port is drawn as the several things it accepts, so the label says so too. */
const labelOf = (handle: GraphHandleInput): string =>
  handle.label ?? handle.name ?? acceptedTypes(handle).join(' · ')

const PORT = 'size-2 rounded-full border'

export function InputPorts({ handles }: { handles: readonly GraphHandleInput[] }) {
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
          <span className="text-muted truncate text-[10px]">{labelOf(handle)}</span>
        </li>
      ))}
    </ul>
  )
}

export function OutputPorts({ handles }: { handles: readonly GraphHandleOutput[] }) {
  return (
    <ul className="flex flex-col items-end gap-2">
      {handles.map(handle => (
        <li key={handle.id} className="relative flex items-center gap-2 pr-1">
          <span className="text-muted truncate text-[10px]">{handle.name ?? handle.type}</span>
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
