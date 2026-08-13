/**
 * What every suite driving a generation seam had to build for itself.
 *
 * Three of them — image, skybox and the claims shared by both — spelt these two identically, and
 * jscpd caught the pair as one of the tree's largest clones. Nothing here asserts anything: it is
 * the scaffolding a seam needs to be watched at all.
 */
import type { Asset } from '@shared/domain/asset'
import { useAssets } from './assets'

/**
 * The catalogue as the main process would answer it once the ingest is done.
 *
 * `refresh` is what a seam calls rather than waiting on the coalesced invalidation, so this is
 * where an asset appears — never before the job reports.
 */
export function catalogueHolds(assets: readonly Asset[]): void {
  useAssets.setState({ refresh: async () => void useAssets.setState({ items: assets }) })
}

/**
 * Lets every pending microtask run.
 *
 * A seam reads the catalogue back before it writes, so without draining them the assertion runs
 * before anything is laid down — and a test passing for THAT reason would pass just as well
 * against a seam that does nothing at all.
 */
export const flush = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0))
