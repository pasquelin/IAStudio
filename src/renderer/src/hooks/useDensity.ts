import { useEffect } from 'react'
import type { Density } from '@shared/domain/settings'

/**
 * Publishes the density on the root element. The CSS gauges (`--sc-control`, `--sc-rail`,
 * `--sc-gutter`) hang off `[data-density]`, so nothing reaches them until this attribute is
 * set — the compact mode simply would not exist.
 */
export function useDensity(density: Density): void {
  useEffect(() => {
    document.documentElement.dataset['density'] = density
  }, [density])
}
