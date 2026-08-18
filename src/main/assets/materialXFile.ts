import {
  MTLX_COLORSPACE,
  MTLX_COMPOSED,
  MTLX_DISPLACEMENT,
  MTLX_ENVELOPE_ATTR,
  MTLX_HEAD_LIMIT,
  MTLX_STUDIO_ATTR,
  MTLX_VERSION,
  type MtlxDocument,
  type MtlxImage,
  type MtlxType,
  type MtlxValue,
  type MtlxWrap,
} from '@shared/domain/materialX'
import { isRecord } from '@shared/guards'
import { attribute, escapeXml, unescapeXml } from './xmlText'

/**
 * The syntax of a `.mtlx`, written and read from the tag stream — the main process has no XML
 * parser and needs none for this subset, exactly as it reads OpenRaster's `stack.xml`.
 *
 * **Nothing here has been checked against a MaterialX renderer**: none is installed on this
 * machine and none will be. What conformance is claimed is claimed against the text of the 1.39
 * specification and against the `.mtlx` files the distribution ships.
 */

const GRAPH = 'NG_scenario'
const SURFACE = 'SR_scenario'
const MATERIAL = 'scenario_material'
const DISPLACE = 'DS_scenario'

/** Trailing zeros make a file that differs from itself between two identical saves. */
const num = (value: number): string => String(Number(value.toFixed(6)))

const list = (values: readonly number[]): string => values.map(num).join(', ')

const imageNode = (input: string): string => `image_${input}`
const tintNode = (input: string): string => `tint_${input}`
const normalNode = (input: string): string => `normalmap_${input}`
const outputName = (input: string): string => `out_${input}`

/** What a chain ends as, which is what the surface input has to be typed. */
function terminalType(image: MtlxImage): MtlxType {
  return image.wrap?.node === 'normalmap' ? 'vector3' : image.type
}

function terminalNode(image: MtlxImage): string {
  if (image.wrap?.node === 'normalmap') return normalNode(image.input)
  return image.multiply ? tintNode(image.input) : imageNode(image.input)
}

function tiledImage(image: MtlxImage): string {
  const colorspace = image.colorspace ? ` colorspace="${escapeXml(image.colorspace)}"` : ''
  return [
    `    <tiledimage name="${imageNode(image.input)}" type="${image.type}">`,
    `      <input name="file" type="filename" value="${escapeXml(image.file)}"${colorspace} />`,
    `      <input name="uvtiling" type="vector2" value="${list(image.tiling)}" />`,
    `      <input name="uvoffset" type="vector2" value="${list(image.offset)}" />`,
    `    </tiledimage>`,
  ].join('\n')
}

/** The nodes one channel puts between its file and the surface, in the order they connect. */
function chainOf(image: MtlxImage): string[] {
  const lines = [tiledImage(image)]

  if (image.multiply) {
    lines.push(
      `    <multiply name="${tintNode(image.input)}" type="color3">`,
      `      <input name="in1" type="color3" nodename="${imageNode(image.input)}" />`,
      `      <input name="in2" type="color3" value="${list(image.multiply)}" />`,
      `    </multiply>`,
    )
  }

  if (image.wrap?.node === 'normalmap') {
    lines.push(
      `    <normalmap name="${normalNode(image.input)}" type="vector3">`,
      // The tint when there is one, never the image underneath it: reading past a node already
      // written would leave it in the file, connected to nothing and read by no one.
      `      <input name="in" type="vector3" nodename="${
        image.multiply ? tintNode(image.input) : imageNode(image.input)
      }" />`,
      `      <input name="scale" type="float" value="${num(image.wrap.scale)}" />`,
      `    </normalmap>`,
    )
  }

  lines.push(
    `    <output name="${outputName(image.input)}" type="${terminalType(image)}" ` +
      `nodename="${terminalNode(image)}" />`,
  )
  return lines
}

function surfaceInput(image: MtlxImage): string {
  return (
    `    <input name="${image.input}" type="${terminalType(image)}" ` +
    `nodegraph="${GRAPH}" output="${outputName(image.input)}" />`
  )
}

function valueInput({ input, type, value }: MtlxValue): string {
  const spelt = typeof value === 'number' ? num(value) : list(value)
  return `    <input name="${input}" type="${type}" value="${spelt}" />`
}

/**
 * The whole file. The envelope attribute is written BEFORE the state one, so a bounded head read
 * reaches the identity whatever the state weighs — the root tag is the first line either way.
 */
export function writeMaterialX(document: MtlxDocument, envelope = ''): string {
  const height = document.images.find(image => image.input === MTLX_DISPLACEMENT)
  const surfaced = document.images.filter(image => image.input !== MTLX_DISPLACEMENT)

  const attributes = [
    `version="${MTLX_VERSION}"`,
    `colorspace="${MTLX_COLORSPACE}"`,
    ...(envelope ? [`${MTLX_ENVELOPE_ATTR}="${escapeXml(envelope)}"`] : []),
    ...(document.studio
      ? [`${MTLX_STUDIO_ATTR}="${escapeXml(JSON.stringify(document.studio))}"`]
      : []),
  ].join(' ')

  // No graph at all when nothing is textured, rather than an empty one: a material of uniform
  // values is the shape a new document has, and an empty `<nodegraph>` is noise every other
  // reader has to step over. Seen in a file the app wrote, not deduced.
  const lines = [
    '<?xml version="1.0"?>',
    `<materialx ${attributes}>`,
    ...(document.images.length > 0
      ? [`  <nodegraph name="${GRAPH}">`, ...document.images.flatMap(chainOf), '  </nodegraph>']
      : []),
  ]

  if (height) {
    lines.push(
      `  <displacement name="${DISPLACE}" type="displacementshader">`,
      `    <input name="displacement" type="${height.type}" nodegraph="${GRAPH}" ` +
        `output="${outputName(height.input)}" />`,
      `    <input name="scale" type="float" value="${num(height.wrap?.scale ?? 1)}" />`,
      '  </displacement>',
    )
  }

  lines.push(
    `  <standard_surface name="${SURFACE}" type="surfaceshader">`,
    ...surfaced.map(surfaceInput),
    ...document.values.map(valueInput),
    '  </standard_surface>',
    `  <surfacematerial name="${MATERIAL}" type="material">`,
    `    <input name="surfaceshader" type="surfaceshader" nodename="${SURFACE}" />`,
    ...(height
      ? [
          `    <input name="${MTLX_DISPLACEMENT}" type="displacementshader" ` +
            `nodename="${DISPLACE}" />`,
        ]
      : []),
    '  </surfacematerial>',
    '</materialx>',
  )

  return `${lines.join('\n')}\n`
}

export type MtlxHead = {
  /** `''` for a file that is not a MaterialX root at all — one that only wears the extension. */
  version: string
  /** The studio's own envelope, or the empty string: a file written elsewhere carries none. */
  envelope: string
}

/** The root tag alone, which is where both custom attributes ride. */
export function mtlxHeadIn(head: string): MtlxHead {
  const root = /<materialx\b([^>]*)>/.exec(head.slice(0, MTLX_HEAD_LIMIT))
  if (!root?.[1]) return { version: '', envelope: '' }
  return {
    version: unescapeXml(attribute(root[1], 'version')),
    envelope: unescapeXml(attribute(root[1], MTLX_ENVELOPE_ATTR)),
  }
}

/** An input reaching into a nodegraph names BOTH, and the pair is what resolves it. */
type GraphOutput = { graph: string; output: string }

type Node = {
  kind: string
  type: string
  /** An input's `nodename`, by input name — what connects this node to the one before it. */
  from: Map<string, string>
  values: Map<string, string>
  colorspaces: Map<string, string>
  connections: Map<string, GraphOutput>
}

const emptyNode = (kind: string, type: string): Node => ({
  kind,
  type,
  from: new Map(),
  values: new Map(),
  colorspaces: new Map(),
  connections: new Map(),
})

/**
 * Every element with a name, and every `<input>` filed under the one that holds it.
 *
 * Walked with a stack rather than by position: a file from elsewhere is free to nest and order
 * its elements however it likes, and only the enclosing element says whose input an input is.
 */
function nodesIn(xml: string): Map<string, Node> {
  const nodes = new Map<string, Node>()
  const open: (Node | null)[] = []

  for (const match of xml.matchAll(/<([a-zA-Z_][\w.]*)\b([^>]*?)(\/?)>|<\/([a-zA-Z_][\w.]*)>/g)) {
    const [, tag, rest = '', selfClosing, closing] = match
    if (closing !== undefined) {
      open.pop()
      continue
    }
    if (tag === undefined) continue

    if (tag === 'input' || tag === 'output') {
      const holder = open[open.length - 1]
      if (!holder) continue
      const name = attribute(rest, 'name')
      const nodename = attribute(rest, 'nodename')
      if (nodename) holder.from.set(name, nodename)
      const output = attribute(rest, 'output')
      if (output) holder.connections.set(name, { graph: attribute(rest, 'nodegraph'), output })
      const value = attribute(rest, 'value')
      if (value) holder.values.set(name, unescapeXml(value))
      const colorspace = attribute(rest, 'colorspace')
      if (colorspace) holder.colorspaces.set(name, unescapeXml(colorspace))
      continue
    }

    const node = emptyNode(tag, attribute(rest, 'type'))
    const name = attribute(rest, 'name')
    if (name) nodes.set(name, node)
    if (!selfClosing) open.push(name ? node : null)
  }

  return nodes
}

const numbersIn = (text: string): number[] =>
  text
    .split(',')
    .map(part => Number(part.trim()))
    .filter(Number.isFinite)

const pairIn = (text: string, fallback: readonly [number, number]): [number, number] => {
  const [x, y] = numbersIn(text)
  return [x ?? fallback[0], y ?? fallback[1]]
}

/**
 * The image a chain ends at, walked BACKWARDS from what the surface is connected to — picking up
 * the tint and the normal scale on the way. `null` for a chain holding no `tiledimage` at all.
 */
function imageBehind(nodes: Map<string, Node>, start: string, input: string): MtlxImage | null {
  let wrap: MtlxWrap | undefined
  let multiply: readonly [number, number, number] | undefined
  let at: string | undefined = start
  const seen = new Set<string>()

  while (at !== undefined && !seen.has(at)) {
    seen.add(at)
    const node: Node | undefined = nodes.get(at)
    if (!node) return null

    if (node.kind === 'tiledimage' || node.kind === 'image') {
      const file = node.values.get('file')
      if (!file) return null
      const colorspace = node.colorspaces.get('file')
      return {
        input,
        type: (node.type || 'color3') as MtlxType,
        file,
        ...(colorspace ? { colorspace } : {}),
        tiling: pairIn(node.values.get('uvtiling') ?? '', [1, 1]),
        offset: pairIn(node.values.get('uvoffset') ?? '', [0, 0]),
        ...(wrap ? { wrap } : {}),
        ...(multiply ? { multiply } : {}),
      }
    }

    if (node.kind === 'normalmap') {
      wrap = { node: 'normalmap', scale: Number(node.values.get('scale') ?? 1) || 1 }
      at = node.from.get('in')
      continue
    }

    if (node.kind === 'multiply') {
      const [r, g, b] = numbersIn(node.values.get('in2') ?? '')
      if (r !== undefined && g !== undefined && b !== undefined) multiply = [r, g, b]
      at = node.from.get('in1')
      continue
    }

    // Any other node is one this studio does not write; the chain is followed through its first
    // connection rather than abandoned, so a file that wraps an image once more still reads.
    at = node.from.values().next().value
  }

  return null
}

/**
 * Which node a nodegraph output stands for. The graph files its `<output>` elements the way any
 * element files its children, so the answer is one lookup — and the graph is NAMED rather than
 * assumed, a file from elsewhere being free to hold several.
 */
function outputTarget(
  nodes: Map<string, Node>,
  { graph, output }: GraphOutput,
): string | undefined {
  const named = nodes.get(graph)?.from.get(output)
  if (named) return named
  // A graph the input did not name: the only honest fallback is the one graph that declares
  // this output, and nothing is answered when several do.
  const holders = [...nodes.values()].filter(
    node => node.kind === 'nodegraph' && node.from.has(output),
  )
  return holders.length === 1 ? holders[0]?.from.get(output) : undefined
}

/**
 * A material read back off its file.
 *
 * Read from `surfacematerial` DOWNWARDS — the surface it names, that surface's inputs, and the
 * chain behind each one — rather than from the elements in the order they appear: a file from
 * elsewhere names its nodes whatever it likes, and only the connections say what feeds what.
 */
export function readMaterialX(xml: string): MtlxDocument {
  const nodes = nodesIn(xml)
  const images: MtlxImage[] = []
  const values: MtlxValue[] = []

  const material = [...nodes.values()].find(node => node.kind === 'surfacematerial')
  const surfaceName = material?.from.get('surfaceshader')
  const surface = surfaceName ? nodes.get(surfaceName) : undefined

  for (const [input, value] of surface?.values ?? []) {
    const numbers = numbersIn(value)
    if (numbers.length === 0) continue
    values.push(
      numbers.length === 1 && numbers[0] !== undefined
        ? { input, type: 'float', value: numbers[0] }
        : { input, type: 'color3', value: numbers },
    )
  }

  for (const [input, output] of surface?.connections ?? []) {
    const target = outputTarget(nodes, output)
    const image = target ? imageBehind(nodes, target, input) : null
    if (image) images.push(image)
  }

  const displaceName = material?.from.get(MTLX_DISPLACEMENT)
  const displace = displaceName ? nodes.get(displaceName) : undefined
  const heightOutput = displace?.connections.get('displacement')
  const heightTarget = heightOutput ? outputTarget(nodes, heightOutput) : undefined
  const height = heightTarget ? imageBehind(nodes, heightTarget, MTLX_DISPLACEMENT) : null
  if (height) {
    images.push({
      ...height,
      wrap: { node: 'displacement', scale: Number(displace?.values.get('scale') ?? 1) || 1 },
    })
  }

  const root = /<materialx\b([^>]*)>/.exec(xml)
  const state = root?.[1] ? unescapeXml(attribute(root[1], MTLX_STUDIO_ATTR)) : ''
  const studio: unknown = state ? JSON.parse(state) : null
  const extra = uncomposedIn(xml, nodes)

  return {
    images,
    values,
    ...(isRecord(studio) ? { studio } : {}),
    ...(extra.length > 0 ? { extra } : {}),
  }
}

/**
 * What the file holds beyond one material — a second `surfacematerial`, a `look`, a `nodedef`.
 *
 * Counted rather than ignored: this studio rewrites a `.mtlx` from ONE material, so a file
 * holding more would come back with the rest deleted. The window refuses the save instead.
 */
function uncomposedIn(xml: string, nodes: Map<string, Node>): string[] {
  const kinds = new Set<string>()
  for (const match of xml.matchAll(/<([a-zA-Z_][\w.]*)\b/g)) {
    const kind = match[1]
    if (kind && !MTLX_COMPOSED.includes(kind)) kinds.add(kind)
  }
  if ([...nodes.values()].filter(node => node.kind === 'surfacematerial').length > 1) {
    kinds.add('surfacematerial')
  }
  return [...kinds]
}
