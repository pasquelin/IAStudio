import { refused, type ActionOutcome } from '@shared/domain/assistant'
import type { DocumentKind } from '@shared/domain/document'
import type { Target } from '@shared/domain/target'
import { useDocuments } from '@/stores/documents'
import { layerTargets, selectLayer } from './canvasHandlers'

/** What one space answers about the document it holds: what may be aimed at, and how to aim. */
export type DocumentTargets = {
  targets: () => readonly Target[]
  select: (id: string) => ActionOutcome
}

/**
 * Every kind, and the one that answers so far — a `Record<DocumentKind, …>` rather than a mounted
 * host, the way `IO_BY_KIND` holds saving: a seventh kind does not compile until it has answered,
 * where a registry would leave the gap silent.
 *
 * `null` is a kind with nothing to aim at YET, and it is deliberately spelled out five times: the
 * compiler is what will name them the day the second space arrives.
 */
const TARGETS_BY_KIND: Record<DocumentKind, DocumentTargets | null> = {
  // Reuses `layer.select` rather than a second path to arm a layer: a guard added there — a
  // locked layer, a collapsed group — has to reach a sentence too.
  image: { targets: layerTargets, select: id => selectLayer({ layerId: id }) },
  scene: null,
  sequence: null,
  audio: null,
  skybox: null,
  texture: null,
}

/**
 * What the document in front can be aimed at, read at CALL time — the way every handler family
 * finds its surface. `null` is an answer: a home screen, or a space that declares nothing.
 */
export function frontTargets(): DocumentTargets | null {
  const { activeId, documents } = useDocuments.getState()
  const kind = activeId === null ? undefined : documents[activeId]?.kind

  return kind === undefined ? null : TARGETS_BY_KIND[kind]
}

/** Aiming, whichever space holds the document. `target.select` is the one spoken door to it. */
export function aimAt(id: string): ActionOutcome {
  return frontTargets()?.select(id) ?? refused('wrongSurface')
}
