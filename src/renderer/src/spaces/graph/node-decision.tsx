import { createContext, use, type ReactNode } from 'react'

/** What a node does with the answer someone gives it. */
export type NodeDecision = (nodeId: string, approved: boolean) => void

/**
 * How an approval node hands its answer back up.
 *
 * A context and not a prop, because React Flow hands a node component nothing but its `data`, and
 * a callback written into `data` would give every node a new object on every render — which is
 * exactly what `adapter.ts` goes out of its way to avoid, since React Flow compares nodes by
 * identity and re-measures whichever one changed.
 *
 * Outside a canvas the answer goes nowhere rather than being unavailable: a node rendered on its
 * own has nobody listening, and a nullable context would put a guard on every site that reads it
 * for a case that only exists in a test.
 */
const NodeDecisionContext = createContext<NodeDecision>(() => {})

export function NodeDecisionProvider({
  onDecide,
  children,
}: {
  onDecide: NodeDecision
  children: ReactNode
}) {
  return <NodeDecisionContext value={onDecide}>{children}</NodeDecisionContext>
}

export const useNodeDecision = (): NodeDecision => use(NodeDecisionContext)
