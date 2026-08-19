import type { AssetType } from '@shared/domain/asset'
import { createMountedHost } from '@/helpers/hostRegistry'

/** What a slot is asking to be filled with, put to whoever is showing the picker. */
export type AssetPickRequest = {
  /** The kinds the slot can take. Nothing else is offered, local or remote. */
  accepts: readonly AssetType[]
  /** What it holds today, so the picker opens on it rather than on nothing. */
  current: string | null
  /** The name of the slot, for the window's own title. Already translated. */
  label: string
}

/** Answers with the asset chosen, or `null` when the choice was called off. */
export type AssetPicker = (request: AssetPickRequest) => Promise<string | null>

const host = createMountedHost<AssetPicker>()

/**
 * Declares the window as the place an asset is chosen from the WHOLE project. Returns the way to
 * take it back down.
 *
 * Mounted by the shell, the way the document namer is: a slot's own list holds what the project
 * has locally, and that is the fast answer — this one is the long one, where the remote library
 * and the explorer are reachable too. A window showing no picker simply draws no browse button.
 */
export const registerAssetPicker = host.hold

/** Whoever can ask, or `null` in a window that shows no picker. */
export const mountedAssetPicker = host.get
