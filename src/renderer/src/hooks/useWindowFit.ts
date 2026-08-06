import { useEffect } from 'react'
import { useTools } from '@/stores/tools'

/**
 * Re-clamps the tool zones when the window changes size. Sizes are persisted, so a layout
 * set on a wide screen would otherwise overflow a narrow one — pushing the panels under the
 * rails and squeezing the documents area to nothing.
 */
export function useWindowFit(): void {
  useEffect(() => {
    const fit = (): void => useTools.getState().fit(window.innerWidth, window.innerHeight)

    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])
}
