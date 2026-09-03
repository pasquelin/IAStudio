import { create } from 'zustand'
import { sceneOf, useScenes } from '@/stores/scenes'

type OptimizationDialogRequest = {
  documentId: string
  selectedIds: readonly string[]
}

type OptimizationDialogState = {
  request: OptimizationDialogRequest | null
  open: (request: OptimizationDialogRequest) => void
  close: () => void
}

export const useOptimizationDialog = create<OptimizationDialogState>(set => ({
  request: null,
  open: request => set({ request }),
  close: () => set({ request: null }),
}))

export function openOptimizationDialog(documentId: string): void {
  const scene = useScenes.getState()
  useOptimizationDialog.getState().open({
    documentId,
    selectedIds: sceneOf(scene, documentId).selectedIds,
  })
}
