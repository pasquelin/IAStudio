import { isRecord, readString } from '@shared/guards'
import { TEXTURE_SLOTS, type TextureSlot } from '@shared/domain/scene'
import { ORIGIN, type Vector } from './bench'

/** How a call's arguments are read, once — the studio's own readers live in the renderer. */

export type Input = Record<string, unknown>

export const text = (input: Input, key: string): string => readString(input, key, '')

export const texts = (input: Input, key: string): readonly string[] => {
  const value = input[key]
  return Array.isArray(value) ? value.filter(one => typeof one === 'string') : []
}

export const number = (input: Input, key: string): number | null =>
  typeof input[key] === 'number' && Number.isFinite(input[key]) ? input[key] : null

export const flag = (input: Input, key: string): boolean => input[key] === true

/** A vector spelled as three optional numbers, over the one the thing already wears. */
export const vector = (input: Input, of: string, current: Vector = ORIGIN): Vector => ({
  x: number(input, `${of}X`) ?? current.x,
  y: number(input, `${of}Y`) ?? current.y,
  z: number(input, `${of}Z`) ?? current.z,
})

/** Whether a vector was named at all — a transform naming none is a call that changes nothing. */
export const named = (input: Input, of: string): boolean =>
  ['X', 'Y', 'Z'].some(axis => number(input, `${of}${axis}`) !== null)

/**
 * The slots a material call names, as `texturesFrom` reads them: a record of SLOT to asset id.
 * `null` is the refusal — the studio answers `badInput` on a value that is not a string.
 */
export function slots(input: Input, key = 'textures'): Partial<Record<TextureSlot, string>> | null {
  const asked = input[key]
  if (asked === undefined) return {}
  if (!isRecord(asked)) return null

  const found: Partial<Record<TextureSlot, string>> = {}
  for (const [slot, value] of Object.entries(asked)) {
    if (typeof value !== 'string') return null
    // A blank id is the map taken OFF, which is not the same as leaving it alone.
    if (value.trim() !== '' && TEXTURE_SLOTS.includes(slot as TextureSlot)) {
      found[slot as TextureSlot] = value
    }
  }

  return found
}
