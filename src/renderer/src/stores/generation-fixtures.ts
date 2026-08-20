/**
 * What every suite driving a generation seam had to build for itself.
 *
 * Three of them — image, skybox and the claims shared by both — spelt these two identically, and
 * jscpd caught the pair as one of the tree's largest clones. Nothing here asserts anything: it is
 * the scaffolding a seam needs to be watched at all.
 */
import type { Asset } from '@shared/domain/asset'
import { installFakeBridge } from '@/services/fakeBridge'
import { useAssets } from './assets'

/**
 * The catalogue as the main process would answer it once the ingest is done.
 *
 * Answered by the BRIDGE, because that is where the landing asks: the shelf is filtered by the
 * space in front and its refresh is coalesced, so a seam reading it would miss a picture whose
 * space is not the one open — and would sometimes read a page sent before the outputs existed.
 *
 * The shelf is filled too, for the assertions that look at what the browser would show.
 */
export function catalogueHolds(assets: readonly Asset[]): void {
  installFakeBridge({ assets: { search: () => Promise.resolve([...assets]) } })
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
