import { assetUrl } from '@shared/domain/asset'
import { bundledAnimationUrl } from '@shared/domain/animationLibrary'
import { clipKeyOf, type ClipLane, type ClipSource } from '@shared/domain/scene'
import type { AnimationGraph } from '@shared/domain/animationGraph'

/** A clip a model's blocks name that its own file did not bring: where to read it, what to call it. */
export type ForeignClip = { key: string; url: string; label: string }

/** Where a clip that did not come with the model is read from — `null` for the model's own. */
export function clipSourceUrl(source: ClipSource): string | null {
  if (source.kind === 'bundled') return bundledAnimationUrl(source.name)
  return source.kind === 'asset' ? assetUrl(source.assetId) : null
}

/**
 * Every clip a document asks a model to play that the model's own file did not bring, once each.
 *
 * Once per KEY and not per block: a walk laid down four times is one file to read, and the key
 * carries the kind, so a shipped `walk` and a project asset called `walk` stay two things.
 */
export function foreignClipsOf(lanes: readonly ClipLane[]): ForeignClip[] {
  const found = new Map<string, ForeignClip>()

  for (const clip of lanes.flatMap(lane => lane.clips)) {
    const url = clipSourceUrl(clip.source)
    const key = clipKeyOf(clip.source)
    if (url && !found.has(key)) found.set(key, { key, url, label: clip.label })
  }
  return [...found.values()]
}

/**
 * Every clip a state machine names that a model's own file did not bring, once per key.
 *
 * Beside `foreignClipsOf` and not folded into it: a graph and a band name their clips in shapes
 * that have nothing in common, and what they produce is the same list.
 */
export function graphClipsOf(graph: AnimationGraph): ForeignClip[] {
  const found = new Map<string, ForeignClip>()

  for (const state of graph.layers.flatMap(one => one.states)) {
    const url = clipSourceUrl(state.source)
    const key = clipKeyOf(state.source)
    if (url && !found.has(key)) found.set(key, { key, url, label: state.source.name })
  }
  return [...found.values()]
}
