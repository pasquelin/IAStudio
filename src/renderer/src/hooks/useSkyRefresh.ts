import { useEffect } from 'react'
import { onSkyChange } from '@/stores/skyboxSources'
import { useLatest } from './useLatest'

/**
 * Tells an engine that a sky it is lit by has moved. Turning a sun moves no asset id, so the shelf
 * says nothing — and WHICH sky moved is not passed on, a viewport being lit by exactly one.
 */
export function useSkyRefresh(refresh: () => void): void {
  const latest = useLatest(refresh)

  useEffect(() => onSkyChange(() => latest.current()), [latest])
}
