import { useMemo } from 'react'
import { subtreesOf } from '@/engines/scene/sceneState'
import { sceneEngineOf } from '@/stores/sceneEngines'
import { sceneOf, useScenes } from '@/stores/scenes'
import { useOptimizationDialog } from '@/hooks/useOptimizationDialog'
import { SceneOptimizationDialogBody } from './SceneOptimizationDialogBody'

export function SceneOptimizationDialog({ documentId }: { documentId: string }) {
  const request = useOptimizationDialog(state => state.request)
  const nodes = useScenes(state => sceneOf(state, documentId).nodes)
  const target = useMemo(
    () => (request?.documentId === documentId ? subtreesOf(nodes, request.selectedIds) : []),
    [documentId, nodes, request],
  )
  const plan = useMemo(
    () =>
      request?.documentId === documentId
        ? sceneEngineOf(documentId)?.analyzeOptimization(request.selectedIds)
        : null,
    [documentId, request],
  )
  if (!request || request.documentId !== documentId || !plan) return null
  return (
    <SceneOptimizationDialogBody
      key={request.selectedIds.join('\u0000')}
      documentId={documentId}
      target={target}
      plan={plan}
    />
  )
}
