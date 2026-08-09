import type { GraphHandleInput, GraphNode, GraphPosition, GraphState } from '@shared/domain/graph'
import type { Asset, AssetType } from '@shared/domain/asset'
import type { FieldDescriptor, ModelFamily } from '@shared/domain/model'
import { defaultValues } from '@/helpers/dynamic-form'
import { DEFAULT_OUTPUT_NAME, handleId } from './handles'
import { nextNodeId } from './mutations'

/**
 * The types a node can be created as, which is fewer than the fifteen the editor draws.
 *
 * A `model` node is missing on purpose: the one Scenario writes carries `{ modelId, form }` and
 * its four input ports come from the model's own schema (invariant 5), so creating one before
 * the registry is wired would put a node on the canvas that nothing can be wired to. It arrives
 * with the rest of the vocabulary; the editor already draws one read back from a workflow.
 */
export type CreatableNodeType = 'text' | 'asset' | 'stickyNote'

export const CREATABLE_NODE_TYPES: readonly CreatableNodeType[] = ['text', 'asset', 'stickyNote']

/**
 * The port every node carries, sticky notes included — read off `wflow_coloring-page-maker` on
 * 9 August 2026, where all four nodes declare it. It is what an `ifElse` steers a node by, so a
 * node created without it could never be made conditional without being rebuilt.
 *
 * Scenario writes a `label` on it ("Is Active"); we do not. A label is DOCUMENT data — it is
 * written into the file and read back by the webapp — so translating it would desynchronise the
 * two editors, and writing it in English would put a hardcoded word in a registry. Left off, the
 * port draws itself from its `name`, and the field stays free for whoever fills it by hand.
 */
const conditionalInput = (id: string) => ({
  id: handleId(id, 'source', 'conditional'),
  name: 'conditional',
  type: 'conditional',
})

/**
 * What a created node outputs, per type, spelled as Scenario spells it.
 *
 * The field name is NOT the type: a text node outputs through `<id>-target-prompt` carrying
 * `type: 'text'`, an asset node through `<id>-target-image` carrying `type: 'image'`. Both were
 * read off a published App; guessing either way round produces a port the converter resolves
 * but the editor cannot label.
 */
const OUTPUTS: Record<'text' | 'asset', { field: string; type: string }> = {
  text: { field: 'prompt', type: 'text' },
  asset: { field: 'image', type: 'image' },
}

/**
 * A node ready to be dropped on the canvas, with the ports its type is wired by.
 *
 * An output handle is a `target`, on the RIGHT, because Scenario's edge points from consumer to
 * provider — see `GraphEdge`. The spelling of the id is the converter's, copied through
 * `handleId` rather than written out.
 */
export function createNode(
  graph: GraphState,
  type: CreatableNodeType,
  position: GraphPosition,
): GraphNode {
  const id = nextNodeId(graph.nodes, type)
  const inputHandles = [conditionalInput(id)]

  // A note is drawn on the canvas and compiles to nothing, so it has no output at all. Its text
  // lives under `content`, not `value` — the field the other two use.
  if (type === 'stickyNote') return { id, type, position, data: { content: '', inputHandles } }

  const { field, type: portType } = OUTPUTS[type]
  const outputHandles = [
    { id: handleId(id, 'target', field), name: DEFAULT_OUTPUT_NAME, type: portType },
  ]

  // `type` on an asset node is the kind of asset it carries, which is also its port's type.
  if (type === 'asset') {
    return { id, type, position, data: { type: portType, inputHandles, outputHandles } }
  }

  return { id, type, position, data: { value: '', inputHandles, outputHandles } }
}

/**
 * The ports a model node is wired by, derived from the model's OWN schema — never a list written
 * per model (invariant 5).
 *
 * Only two kinds of field become a port, which is what a published App shows: the prompt, and
 * every picture the model takes. Its numbers, its toggles and its enums stay in `form` — read
 * off `wflow_coloring-page-maker`, where `numOutputs`, `width`, `quality` and `background` are
 * in the form and only `prompt`, `referenceImages` and `mask` are ports.
 */
export function modelPorts(
  id: string,
  fields: readonly FieldDescriptor[],
): readonly GraphHandleInput[] {
  const ports = fields.flatMap(field => {
    const type = portTypeOf(field)
    if (!type) return []
    return [{ id: handleId(id, 'source', field.key), name: field.key, type }]
  })

  return [conditionalInput(id), ...ports]
}

/** `undefined` for a field that is a setting rather than an input something can feed. */
function portTypeOf(field: FieldDescriptor): string | undefined {
  if (field.kind === 'image') return 'image'
  // The field the assistant rewrites is the prompt, and the API marks it itself — so the one
  // text field a graph feeds is named by the model, never guessed from its key.
  if (field.promptSpark) return 'prompt'
  return undefined
}

/**
 * A generator node, of the family a palette entry names.
 *
 * Its id reads `imageGenerator1`, as the webapp names them — the type stays `model`. The output
 * carries the family's own kind, which is what the node produces and what the next node's port
 * will be matched against.
 */
export function createModelNode(
  graph: GraphState,
  family: ModelFamily,
  modelId: string,
  fields: readonly FieldDescriptor[],
  position: GraphPosition,
): GraphNode {
  const id = nextNodeId(graph.nodes, `${family === '3d' ? 'threeD' : family}Generator`)
  const kind = OUTPUT_KIND_BY_FAMILY[family]

  return {
    id,
    type: 'model',
    position,
    data: {
      modelId,
      type: kind,
      form: defaultValues(fields),
      inputHandles: modelPorts(id, fields),
      outputHandles: [{ id: handleId(id, 'target', kind), name: DEFAULT_OUTPUT_NAME, type: kind }],
    },
  }
}

/**
 * What a family produces, as a port type. Not the family name: Scenario's ports speak of assets
 * — an image model outputs `image`, a texture model outputs a picture too.
 */
const OUTPUT_KIND_BY_FAMILY: Record<ModelFamily, string> = {
  image: 'image',
  video: 'video',
  '3d': 'model3d',
  audio: 'audio',
  texture: 'image',
  skybox: 'image',
  upscale: 'image',
  'background-removal': 'image',
  vectorization: 'image',
  other: 'image',
}

/**
 * An asset node already holding its asset — what a drop onto the canvas becomes.
 *
 * `value` is the asset id, which is how a published App carries one (`asset_Hr…` on the
 * reference-image node), and the port's type is the kind the asset is: dropping a sound must
 * not offer a picture port that nothing would accept.
 */
export function assetNode(graph: GraphState, asset: Asset, position: GraphPosition): GraphNode {
  const id = nextNodeId(graph.nodes, 'asset')
  const kind = PORT_KIND_BY_ASSET[asset.type]

  return {
    id,
    type: 'asset',
    position,
    data: {
      type: kind,
      value: asset.id,
      title: asset.name,
      inputHandles: [conditionalInput(id)],
      outputHandles: [{ id: handleId(id, 'target', kind), name: DEFAULT_OUTPUT_NAME, type: kind }],
    },
  }
}

/** What an asset is called on a port. `mesh` is `model3d` there — Scenario's own spelling. */
const PORT_KIND_BY_ASSET: Record<AssetType, string> = {
  image: 'image',
  video: 'video',
  audio: 'audio',
  mesh: 'model3d',
  texture: 'image',
  skybox: 'image',
}
