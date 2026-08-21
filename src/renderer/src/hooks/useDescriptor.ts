import { useQuery } from '@tanstack/react-query'
import type { ModelDescriptor } from '@shared/domain/model'
import { getBridge } from '@/services/bridge'

/** The schema `DynamicForm` renders from, cached by the query client the main window mounts. */
export function useDescriptor(modelId: string | null) {
  return useQuery<ModelDescriptor | null>({
    queryKey: ['model', modelId],
    queryFn: () =>
      modelId ? (getBridge()?.provider.describeModel(modelId) ?? null) : Promise.resolve(null),
    enabled: modelId !== null,
  })
}
