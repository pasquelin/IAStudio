import type { ModelFamily } from '@shared/domain/model'
import { CREATABLE_NODE_TYPES, type CreatableNodeType } from '@/engines/graph/factory'
import { NODE_LABEL_KEYS } from './node-labels'

/**
 * What the add menu offers, in the two groups Scenario's own palette reads: what comes IN, and
 * what GENERATES.
 *
 * The entries are not the fifteen node types. A generator entry is a `model` node narrowed to
 * one family — four entries, one type — exactly as the webapp lists "Image Generator", "Video
 * Generator" and the rest. Which model each one lands on is the Models panel's business, not a
 * choice made here.
 */
export type PaletteEntry =
  | { group: 'input'; id: string; node: CreatableNodeType }
  | { group: 'generator'; id: string; family: ModelFamily }

/** The families a graph generates with, in the order the webapp lists them. */
export const GENERATOR_FAMILIES: readonly ModelFamily[] = ['image', 'video', '3d', 'audio']

export const PALETTE: readonly PaletteEntry[] = [
  ...CREATABLE_NODE_TYPES.map((node): PaletteEntry => ({ group: 'input', id: node, node })),
  ...GENERATOR_FAMILIES.map((family): PaletteEntry => ({
    group: 'generator',
    id: `generator-${family}`,
    family,
  })),
]

/** The i18n key of an entry's label — the label itself is never written here. */
export function paletteLabelKey(entry: PaletteEntry): string {
  // Never null for a creatable type, but said rather than asserted: the record is what decides.
  if (entry.group === 'input') return NODE_LABEL_KEYS[entry.node] ?? entry.node
  return `families.${entry.family}`
}
