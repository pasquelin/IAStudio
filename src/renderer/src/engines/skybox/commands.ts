import type { AdjustmentStack } from '@shared/domain/adjustments'
import { NEUTRAL_ADJUSTMENTS } from '@shared/domain/adjustments'
import type { SphericalAngles } from '@shared/domain/angles'
import type { TextureRef } from '@shared/domain/scene'
import type { SkyboxContent, SkyboxEnvironment, SunSettings } from '@shared/domain/skybox'
import type { Command } from '../core/history'

/**
 * Skybox edits. Like the scene commands, each captures what it needs to revert **as it is
 * applied** rather than as it is built — so a command survives being redone.
 *
 * The `id` is what the history coalesces on: every frame of one slider drag carries the same
 * id and collapses into a single undo entry, while moving to another slider starts a new one.
 */

function replaceSection<K extends keyof SkyboxContent>(
  id: string,
  key: K,
  next: (previous: SkyboxContent[K]) => SkyboxContent[K],
): Command<SkyboxContent> {
  // A flag rather than a null sentinel: `source` is legitimately null, and reverting to "no
  // sky" has to be told apart from never having captured anything.
  let captured = false
  let before: SkyboxContent[K] | undefined

  return {
    id,
    apply: content => {
      before = content[key]
      captured = true
      return { ...content, [key]: next(content[key]) }
    },
    revert: content => (captured ? { ...content, [key]: before } : content),
  }
}

export function setAdjustment<K extends keyof AdjustmentStack>(
  key: K,
  value: AdjustmentStack[K],
): Command<SkyboxContent> {
  return replaceSection(`adjust:${key}`, 'adjustments', previous => ({ ...previous, [key]: value }))
}

export function resetAdjustments(): Command<SkyboxContent> {
  return replaceSection('adjust:reset', 'adjustments', () => ({ ...NEUTRAL_ADJUSTMENTS }))
}

export function setSunSetting<K extends keyof SunSettings>(
  key: K,
  value: SunSettings[K],
): Command<SkyboxContent> {
  return replaceSection(`sun:${key}`, 'sun', previous => ({ ...previous, [key]: value }))
}

/**
 * The drag in the viewport, which moves both angles at once. One id for the whole gesture, so
 * dragging the sun across the sky costs one undo rather than one per frame.
 */
export function setSunAngles(angles: SphericalAngles): Command<SkyboxContent> {
  return replaceSection('sun:angles', 'sun', previous => ({ ...previous, ...angles }))
}

export function setEnvironmentSetting<K extends keyof SkyboxEnvironment>(
  key: K,
  value: SkyboxEnvironment[K],
): Command<SkyboxContent> {
  return replaceSection(`environment:${key}`, 'environment', previous => ({
    ...previous,
    [key]: value,
  }))
}

export function setSource(source: TextureRef | null): Command<SkyboxContent> {
  return replaceSection('source', 'source', () => source)
}

/**
 * What a finished generation leaves behind: the picture and the prompt that made it, in ONE
 * entry. Two commands would be two undo steps, and stepping back through the middle one would
 * leave a prompt describing a sky that is no longer on screen.
 *
 * An absent provenance is written as absent rather than skipped: keeping the previous prompt
 * beside a new picture would credit it with something it did not make.
 */
export function applyGeneration(
  source: TextureRef | null,
  generation: SkyboxContent['generation'],
): Command<SkyboxContent> {
  let before: Pick<SkyboxContent, 'source' | 'generation'> | null = null

  return {
    id: 'generation',
    apply: content => {
      before = { source: content.source, generation: content.generation }
      return { ...content, source, generation }
    },
    revert: content => (before ? { ...content, ...before } : content),
  }
}
