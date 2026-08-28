import { z } from 'zod'
import { FONT_SOURCES } from '@shared/domain/font'
import {
  UI_ALIGNS,
  UI_ANCHORS,
  UI_CURSORS,
  UI_FITS,
  UI_JUSTIFIES,
  UI_MODES,
  UI_SCROLL_AXES,
  UI_TEXT_ALIGNS,
  UI_SCHEMA_URL,
  UI_VERSION,
  type UiDocument,
  type UiElement,
} from '@shared/domain/ui'

/**
 * The whole of what a `.ui.json` may hold, PUBLISHED — `docs/schema/ui-1.schema.json`, which
 * the files themselves point at through `$schema`.
 *
 * 🛑 Not the same schema as `uiValidation.ts`, and the difference is deliberate. That one is
 * shallow because it runs on the file layer, where a deep parse per document at listing time is
 * a freeze; this one never runs in the studio at all. It is the third description of the format
 * after the types and the tolerant reader, and what stops the three from drifting is the
 * `satisfies` below: a field added to `UiDocument` and forgotten here does not compile.
 */
const size = z.object({ width: z.number(), height: z.number() }).meta({ id: 'UiSize' })

const point = z.object({ x: z.number(), y: z.number() }).meta({ id: 'UiPoint' })

const edges = z
  .object({
    top: z.number(),
    right: z.number(),
    bottom: z.number(),
    left: z.number(),
  })
  .meta({ id: 'UiEdges' })

const length = z.object({ unit: z.enum(['px', 'percent']), value: z.number() })

const sizing = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('fixed'), length }),
  z.object({ mode: z.literal('auto') }),
  z.object({ mode: z.literal('stretch') }),
])

const anchor = z.enum(UI_ANCHORS)

const placement = z
  .object({
    anchor,
    pivot: anchor,
    offset: point,
    size: z.object({ width: sizing, height: sizing }),
    min: size,
    max: size,
    aspect: z.number(),
    margin: edges,
    grow: z.number(),
  })
  .meta({ id: 'UiPlacement' })

const fit = z.enum(UI_FITS)

const fill = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('none') }),
  z.object({ kind: z.literal('color'), color: z.string() }),
  z.object({ kind: z.literal('image'), assetId: z.string(), fit }),
])

const style = z
  .object({
    background: fill,
    border: z.object({ width: z.number(), color: z.string(), radius: z.number() }),
    opacity: z.number(),
    padding: edges,
  })
  .meta({ id: 'UiStyle' })

const text = z
  .object({
    value: z.string(),
    font: z.object({ source: z.enum(FONT_SOURCES), family: z.string() }),
    size: z.number(),
    weight: z.number(),
    align: z.enum(UI_TEXT_ALIGNS),
    color: z.string(),
    wrap: z.boolean(),
  })
  .meta({ id: 'UiText' })

const interaction = z
  .object({
    action: z.string(),
    focusable: z.boolean(),
    cursor: z.enum(UI_CURSORS),
  })
  .meta({ id: 'UiInteraction' })

const shared = {
  id: z.string(),
  name: z.string(),
  visible: z.boolean(),
  enabled: z.boolean(),
  locked: z.boolean(),
  place: placement,
  style,
  interaction,
}

/** The tree is recursive, so every container reads its children through this one lazy hole. */
const element: z.ZodType<UiElement> = z
  .lazy(() =>
    z.discriminatedUnion('type', [
      z.object({ ...shared, type: z.literal('screen'), children: z.array(element) }),
      z.object({ ...shared, type: z.literal('panel'), children: z.array(element) }),
      z.object({
        ...shared,
        type: z.literal('stack'),
        stack: z.object({
          direction: z.enum(['row', 'column']),
          gap: z.number(),
          align: z.enum(UI_ALIGNS),
          justify: z.enum(UI_JUSTIFIES),
          wrap: z.boolean(),
        }),
        children: z.array(element),
      }),
      z.object({
        ...shared,
        type: z.literal('grid'),
        grid: z.object({ columns: z.number(), gap: z.number(), align: z.enum(UI_ALIGNS) }),
        children: z.array(element),
      }),
      z.object({
        ...shared,
        type: z.literal('scroll'),
        scroll: z.object({ axis: z.enum(UI_SCROLL_AXES) }),
        children: z.array(element),
      }),
      z.object({ ...shared, type: z.literal('spacer') }),
      z.object({ ...shared, type: z.literal('text'), text }),
      z.object({
        ...shared,
        type: z.literal('image'),
        image: z.object({ assetId: z.string(), fit, tint: z.string() }),
      }),
      z.object({ ...shared, type: z.literal('button'), text, children: z.array(element) }),
      z.object({
        ...shared,
        type: z.literal('progress'),
        progress: z.object({
          value: z.number(),
          min: z.number(),
          max: z.number(),
          fill: z.string(),
          track: z.string(),
        }),
      }),
      z.object({
        ...shared,
        type: z.literal('slider'),
        slider: z.object({
          value: z.number(),
          min: z.number(),
          max: z.number(),
          step: z.number(),
        }),
      }),
      z.object({
        ...shared,
        type: z.literal('input'),
        input: z.object({
          value: z.string(),
          placeholder: z.string(),
          maxLength: z.number(),
          secret: z.boolean(),
        }),
      }),
      z.object({
        ...shared,
        type: z.literal('checkbox'),
        checkbox: z.object({ checked: z.boolean() }),
      }),
    ]),
  )
  .meta({ id: 'UiElement' })

const screen = z.object({ ...shared, type: z.literal('screen'), children: z.array(element) })

const binding = z.object({
  element: z.string(),
  property: z.string(),
  source: z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('component'),
      entity: z.string(),
      component: z.string(),
      field: z.string(),
    }),
    z.object({ kind: z.literal('game'), path: z.string() }),
  ]),
  fallback: z.union([z.string(), z.number(), z.boolean(), z.null()]),
})

/**
 * 🛑 `satisfies`, and it is what makes a third description of the format safe: a field gained by
 * `UiDocument` and not written here stops compiling. It cannot see the other direction — a field
 * here that the type dropped — which the round-trip suites cover instead.
 */
export const uiDocumentSchema = z.object({
  version: z.number().int().min(1).max(UI_VERSION),
  mode: z.enum(UI_MODES),
  design: size,
  root: screen,
  bindings: z.array(binding),
}) satisfies z.ZodType<UiDocument>

/** Where the published file lives. The URL it is served at is `UI_SCHEMA_URL`, in the format. */
export const UI_SCHEMA_FILE = `docs/schema/ui-${UI_VERSION}.schema.json`

/** The published document, recomputed. `main/project/uiSchema.test.ts` holds the file to it. */
export function uiJsonSchema(): Record<string, unknown> {
  return {
    $id: UI_SCHEMA_URL,
    title: 'IA Studio interface',
    ...z.toJSONSchema(uiDocumentSchema, { io: 'input' }),
  }
}
