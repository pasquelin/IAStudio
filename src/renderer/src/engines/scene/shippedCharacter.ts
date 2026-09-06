/**
 * Which asset the shipped character became in the open project, and therefore what a player
 * module is born wearing.
 *
 * Module state rather than a store, for the reason `checkerTextures` holds its own: the factories
 * that make nodes are synchronous — they run inside a command, between two entries of the history
 * — and copying a mesh into a project is not. `ensureShippedCharacter` is what the two doors that
 * make modules await first: the 3D space when it mounts, and the new-document flow before it seeds
 * a template.
 */
import { DEFAULT_CHARACTER_LEVEL } from '@shared/domain/characterLevel'
import { getBridge } from '@/services/bridge'

let assetId: string | null = null

/** The install in flight, by project — so ten open scenes ask the main process once. */
let running: { path: string; work: Promise<void> } | null = null

/**
 * The shipped character in the open project, and its id remembered. Awaiting it is what lets
 * `playerModuleNodes` stay synchronous at the moment a module is actually made.
 *
 * Asked on the way BACK as much as on the way in: a slow install for the project one has just
 * left resolves after the next one has answered, and would hand a fresh module the asset id of a
 * project this window no longer has open.
 */
export function ensureShippedCharacter(path: string): Promise<void> {
  if (path === '') {
    forgetShippedCharacter()
    return Promise.resolve()
  }

  if (running && running.path === path) return running.work

  const work = install(path)
  running = { path, work }
  return work
}

async function install(path: string): Promise<void> {
  const isCurrent = (): boolean => running?.path === path

  try {
    const installed = await getBridge()?.assets.installBundledCharacter(DEFAULT_CHARACTER_LEVEL)
    if (isCurrent()) assetId = installed?.assetId ?? null
  } catch {
    // A project that cannot be written to is the one case a module still comes out as boxes. The
    // main process is where that failure is logged; here it is forgotten rather than kept, so the
    // next mount asks again instead of leaving the project without a body for the session.
    if (isCurrent()) forgetShippedCharacter()
  }
}

export function rememberShippedCharacter(id: string | null): void {
  assetId = id
}

export function forgetShippedCharacter(): void {
  assetId = null
  running = null
}

/**
 * The character a module wears, or `null` while none has landed — which is what makes the figure
 * of boxes a FALLBACK rather than dead code: a module is never born bodiless.
 */
export function shippedCharacterAssetId(): string | null {
  return assetId
}
