import { useEffect } from 'react'
import { useSkyboxes } from '@/stores/skyboxes'
import { onSkiesRead } from '@/stores/skyboxSources'
import { useLatest } from './useLatest'

/**
 * Tells an engine that a sky it is lit by has moved. Turning a sun moves no asset id, so the shelf
 * says nothing — and WHICH sky moved is not passed on, a viewport being lit by exactly one.
 */
export function useSkyRefresh(refresh: () => void): void {
  const latest = useLatest(refresh)

  useEffect(() => {
    const tabs = useSkyboxes.subscribe(
      (state, before) => state.states !== before.states && latest.current(),
    )
    const files = onSkiesRead(() => latest.current())

    return () => {
      tabs()
      files()
    }
  }, [latest])
}
