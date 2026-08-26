import { Color, Vector2, type IUniform } from 'three'
import { POST_EFFECTS, type PostEffect } from '@shared/domain/postProcessing'

/**
 * Reading a parameter, and writing it into a uniform. The DEFAULT is read off the CATALOGUE: a
 * fallback written beside a uniform is a second default, free to drift from the one the panel,
 * the presets and the file reader share.
 */

const specOf = (effect: PostEffect, key: string) => POST_EFFECTS[effect.effect].params[key]

export function paramNumber(effect: PostEffect, key: string): number {
  const value = effect.params[key]
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const fallback = specOf(effect, key)?.default
  return typeof fallback === 'number' ? fallback : 0
}

export function paramFlag(effect: PostEffect, key: string): boolean {
  const value = effect.params[key]
  if (typeof value === 'boolean') return value
  return specOf(effect, key)?.default === true
}

export function paramText(effect: PostEffect, key: string): string {
  const value = effect.params[key]
  if (typeof value === 'string') return value
  const fallback = specOf(effect, key)?.default
  return typeof fallback === 'string' ? fallback : ''
}

/** A uniform bag as three hands it back. `ShaderPass` types its values `any`; nothing reads one. */
export type Uniforms = Record<string, IUniform>

/** Written IN PLACE: a fresh `{ value }` per frame is one object per uniform per surface. */
export function write(uniforms: Uniforms, name: string, value: number): void {
  const uniform = uniforms[name]
  if (uniform) uniform.value = value
}

export function writeVector(uniforms: Uniforms, name: string, x: number, y: number): void {
  const held = uniforms[name]?.value
  if (held instanceof Vector2) held.set(x, y)
}

/** `setStyle` decodes sRGB into the working space, which is what the chain is in. */
export function writeColour(uniforms: Uniforms, name: string, css: string): void {
  const held = uniforms[name]?.value
  if (held instanceof Color && css !== '') held.setStyle(css)
}
