import { useEffect } from 'react'
import { onMaterialChange } from '@/stores/materialSources'
import { useLatest } from './useLatest'

/**
 * Tells an engine to dress again the models wearing the material documents that just changed.
 *
 * Sibling of `useShelfRefresh`: a model names a material DOCUMENT, and swapping one of its
 * channels moves no asset id, so the shelf says nothing.
 */
export function useMaterialRefresh(refresh: (materialIds: readonly string[]) => void): void {
  const latest = useLatest(refresh)

  useEffect(() => onMaterialChange(ids => latest.current(ids)), [latest])
}
