import { useEffect } from 'react'
import type { Density } from '@shared/domain/settings'
import { forgetPalette } from '@/engines/timeline/painter'

/**
 * Publishes the density on the root element. The CSS gauges (`--sc-control`, `--sc-rail`,
 * `--sc-gutter`) hang off `[data-density]`, so nothing reaches them until this attribute is
 * set — the compact mode simply would not exist.
 */
export function useDensity(density: Density): void {
  useEffect(() => {
    document.documentElement.dataset['density'] = density
    // The canvas reads its colours from these same custom properties and caches them: without
    // this it would keep painting with the ones resolved before the attribute moved.
    forgetPalette()
  }, [density])
}
