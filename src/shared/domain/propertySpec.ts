/**
 * What a field of a descriptor IS, so a panel can be derived from the descriptor rather than
 * written per shape — the rule invariant 5 states for generation forms, applied to the inspector.
 *
 * In `shared/` rather than beside the tables that use it because the post-processing catalogue
 * declares its parameters with these specs and is read by the main process and the MCP registry,
 * neither of which may pull three.js in.
 */
import type { Vector3 } from './transform'
import type { NumericBounds } from '../numeric'

/**
 * The shelf a picked asset comes off, spelled here rather than imported from `asset.ts`.
 *
 * That module reaches `scene.ts` through `material.ts`, and `scene.ts` reads THIS one — the
 * import would close a cycle, and `import-cycles.test.ts` counts a type-only import like any
 * other. `propertySpec.test.ts` holds these two to being real `AssetType` members.
 */
export type PropertyAssetType = 'texture' | 'image'

export const PROPERTY_ASSET_TYPES: readonly PropertyAssetType[] = ['texture', 'image']

export type PropertySpec =
  | ({ control: 'number' } & NumericBounds & { step: number })
  /** A value with both ends: how far along its range it sits is what the user is judging. */
  | { control: 'slider'; min: number; max: number; step: number }
  | { control: 'color' }
  | { control: 'vector3'; step: number }
  | { control: 'toggle' }
  /**
   * One of a closed list. `labelPrefix` is completed by the value to name each row — a composed
   * key, so it is declared in `DYNAMIC_KEYS` rather than found by the literal-key guard.
   */
  | { control: 'choice'; options: readonly string[]; labelPrefix: string }
  /** An entry of the catalogue, by id. An empty string is « none picked ». */
  | { control: 'asset'; assetType: PropertyAssetType }

export type FieldValue = number | string | boolean | Vector3

/**
 * What a spec holds a NUMBER to, when it holds it to anything.
 *
 * One narrowing rather than a `control ===` chain per caller: a control gained without bounds
 * used to make every reader of `min` fail to compile in a different file.
 */
export function numericBoundsOf(spec: PropertySpec | undefined): NumericBounds | null {
  if (spec?.control === 'number' || spec?.control === 'slider') return spec
  return null
}
