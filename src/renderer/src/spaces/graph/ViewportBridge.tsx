import { useEffect } from 'react'
import { useReactFlow } from '@xyflow/react'
import type { GraphPosition } from '@shared/domain/graph'

export type ViewportBridgeProps = {
  onReady: (toFlow: (at: { x: number; y: number }) => GraphPosition) => void
}

/**
 * Hands the viewport's screen-to-graph conversion up to the canvas.
 *
 * It exists because `useReactFlow` only answers under React Flow's provider, and the surfaces
 * that need the conversion — the asset drop target wrapped AROUND the canvas — sit above it.
 * Renders nothing: it is a wire, not a control.
 */
export function ViewportBridge({ onReady }: ViewportBridgeProps) {
  const { screenToFlowPosition } = useReactFlow()

  // Braces, deliberately: the arrow's value would be taken for a cleanup, and React would call
  // the converter with no argument on the next render — which throws inside React Flow.
  useEffect(() => {
    onReady(screenToFlowPosition)
  }, [onReady, screenToFlowPosition])

  return null
}
