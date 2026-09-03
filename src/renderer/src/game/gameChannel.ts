import type { RuntimeReport } from '@shared/domain/gameRuntime'
import type { ScriptModule } from '@game/ports/scriptPort'
import type { ScriptTrouble } from '@/engines/code/scriptCompiler'
import type { SceneState } from '@/engines/scene/sceneState'
import type { RuntimeWorldPatch } from '@/engines/scene/runtimeWorldCompiler'
import type { SceneLookup } from './playSession'

/**
 * What the studio and the game window say to each other. A `BroadcastChannel` and not the bridge,
 * for the reason `mirrorChannel` gives: both windows load the same bundle and already share these
 * types. The bridge keeps what only it can do — opening the window, closing it, saying it went.
 */
export type GameMessage =
  /** Play: the scene to run, and the project's scripts already transpiled. */
  | {
      kind: 'play'
      documentId: string
      scene: SceneState
      modules: readonly ScriptModule[]
      troubles: readonly ScriptTrouble[]
    }
  /** The document was edited under a running game — `createStudioRender` follows it per frame. */
  | { kind: 'edit'; documentId: string; patch: RuntimeWorldPatch }
  /** The studio answering a `want`: what that name resolved to, in the game's own three values. */
  | { kind: 'scene'; scene: string; found: SceneLookup }
  /** Something to do to a running game, carrying the id its answer must quote. */
  | { kind: 'command'; id: number; command: GameCommand }
  /** The studio is going away: whatever is playing has nothing left to play for. */
  | { kind: 'gone' }
  /** Drops every compiled representation held for this authoring scene. */
  | { kind: 'clearOptimization'; documentId: string }
  /**
   * The game window asking for the game, which it must: a channel replays nothing, and the window
   * is opened AFTER the studio published. Without it the window sits on an empty scene.
   */
  | { kind: 'ask' }
  /** What the running game says about itself, six times a second — see `publish`. */
  | { kind: 'report'; documentId: string; report: RuntimeReport }
  /** A scene the game asked for by name, which only the studio's stores can resolve. */
  | { kind: 'want'; scene: string }
  /** The answer to one `command`: what `step` ran, and whether there was a game to run it on. */
  | { kind: 'done'; id: number; ok: boolean; ran: number }

export type GameCommand =
  | { name: 'pause' }
  | { name: 'resume' }
  | { name: 'stop' }
  | { name: 'step'; steps: number }
  | { name: 'loadScene'; scene: string; fade: number }

const CHANNEL = 'ia-studio.game'

/** Opens the channel. Both ends call this; each posts what the other listens for. */
export function openGameChannel(): BroadcastChannel {
  return new BroadcastChannel(CHANNEL)
}

export function clearGameOptimizationCache(documentId: string): void {
  const channel = openGameChannel()
  channel.postMessage({ kind: 'clearOptimization', documentId } satisfies GameMessage)
  channel.close()
}

/**
 * Reads a message off the wire, or nothing. A `BroadcastChannel` is reachable by anything on this
 * origin, so what arrives is checked — a window would else hand a stranger to a game runtime.
 */
export function gameMessageOf(data: unknown): GameMessage | null {
  if (typeof data !== 'object' || data === null || !('kind' in data)) return null

  if (data.kind === 'ask') return { kind: 'ask' }
  if (data.kind === 'gone') return { kind: 'gone' }

  if (data.kind === 'clearOptimization' && 'documentId' in data) {
    return typeof data.documentId === 'string'
      ? { kind: 'clearOptimization', documentId: data.documentId }
      : null
  }

  if (data.kind === 'play' && 'documentId' in data && 'scene' in data) {
    const { documentId, scene } = data
    if (typeof documentId !== 'string' || !isScene(scene)) return null
    const modules = 'modules' in data ? data.modules : []
    const troubles = 'troubles' in data ? data.troubles : []
    if (!Array.isArray(modules) || !Array.isArray(troubles)) return null
    return { kind: 'play', documentId, scene, modules, troubles }
  }

  if (data.kind === 'edit' && 'documentId' in data && 'patch' in data) {
    const { documentId, patch } = data
    return typeof documentId === 'string' && isRuntimePatch(patch)
      ? { kind: 'edit', documentId, patch }
      : null
  }

  if (data.kind === 'scene' && 'scene' in data && 'found' in data) {
    const { scene, found } = data
    if (typeof scene !== 'string') return null
    if (found === 'reading' || found === 'unknown') return { kind: 'scene', scene, found }
    if (
      typeof found !== 'object' ||
      found === null ||
      !('state' in found) ||
      !('document' in found)
    )
      return null
    const { state, document } = found
    return isScene(state) && typeof document === 'string'
      ? { kind: 'scene', scene, found: { state, document } }
      : null
  }

  if (data.kind === 'command' && 'id' in data && 'command' in data) {
    const { id, command } = data
    const asked = commandOf(command)
    return typeof id === 'number' && asked ? { kind: 'command', id, command: asked } : null
  }

  if (data.kind === 'report' && 'documentId' in data && 'report' in data) {
    const { documentId, report } = data
    return typeof documentId === 'string' && isReport(report)
      ? { kind: 'report', documentId, report }
      : null
  }

  if (data.kind === 'want' && 'scene' in data) {
    const { scene } = data
    return typeof scene === 'string' ? { kind: 'want', scene } : null
  }

  if (data.kind === 'done' && 'id' in data && 'ok' in data && 'ran' in data) {
    const { id, ok, ran } = data
    return typeof id === 'number' && typeof ok === 'boolean' && typeof ran === 'number'
      ? { kind: 'done', id, ok, ran }
      : null
  }

  return null
}

function isRuntimePatch(value: unknown): value is RuntimeWorldPatch {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as {
    changedNodes?: unknown
    removedIds?: unknown
    order?: unknown
    world?: unknown
    animation?: unknown
  }
  return (
    Array.isArray(candidate.changedNodes) &&
    candidate.changedNodes.every(isNode) &&
    Array.isArray(candidate.removedIds) &&
    candidate.removedIds.every(id => typeof id === 'string') &&
    (candidate.order === null ||
      (Array.isArray(candidate.order) && candidate.order.every(id => typeof id === 'string'))) &&
    (candidate.world === null || isRecord(candidate.world)) &&
    (candidate.animation === null || isRecord(candidate.animation))
  )
}

function isNode(value: unknown): boolean {
  return isRecord(value) && typeof Reflect.get(value, 'id') === 'string'
}

function isRecord(value: unknown): value is object {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function commandOf(value: unknown): GameCommand | null {
  if (typeof value !== 'object' || value === null || !('name' in value)) return null
  if (value.name === 'pause' || value.name === 'resume' || value.name === 'stop') {
    return { name: value.name }
  }
  if (value.name === 'step' && 'steps' in value) {
    const { steps } = value
    return typeof steps === 'number' ? { name: 'step', steps } : null
  }
  if (value.name === 'loadScene' && 'scene' in value && 'fade' in value) {
    const { scene, fade } = value
    return typeof scene === 'string' && typeof fade === 'number'
      ? { name: 'loadScene', scene, fade }
      : null
  }
  return null
}

/** The shape a game runtime reads, checked at the depth it is read at — nodes and the animation. */
function isScene(value: unknown): value is SceneState {
  if (typeof value !== 'object' || value === null) return false
  // The cast asserts NOTHING: it names the fields as `unknown` so they can be read, and both are
  // tested below before this answers true.
  const candidate = value as { nodes?: unknown; animation?: unknown }
  return (
    Array.isArray(candidate.nodes) &&
    typeof candidate.animation === 'object' &&
    candidate.animation !== null
  )
}

/** The shape the transport draws, checked at the depth it draws from. */
function isReport(value: unknown): value is RuntimeReport {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as { state?: unknown; logs?: unknown; errors?: unknown }
  return (
    (candidate.state === 'edit' || candidate.state === 'playing' || candidate.state === 'paused') &&
    Array.isArray(candidate.logs) &&
    Array.isArray(candidate.errors)
  )
}
