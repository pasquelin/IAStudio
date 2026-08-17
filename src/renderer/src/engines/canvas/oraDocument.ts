import {
  isOraGroup,
  type OraDocument,
  type OraNode,
  type OraLayer,
} from '@shared/domain/openRaster'
import type { LayerPixels } from './CanvasEngine'
import {
  IDENTITY,
  BLEND_MODES,
  deserializeCanvas,
  isGroup,
  layerBase,
  serializeCanvas,
  type BlendMode,
  type CanvasState,
  type GroupLayer,
  type Layer,
  type PixelLayer,
} from './canvasState'

const PLAIN = 'svg:src-over'

/** `data/p_<id>.png` and `data/m_<id>.png`, the names `packOpenRaster` files the bytes under. */
const pathOf = (layerId: string, mask: boolean): string => `data/${mask ? 'm' : 'p'}_${layerId}.png`

const compositeOf = (blend: BlendMode): string => (blend === 'normal' ? PLAIN : `svg:${blend}`)

function blendOf(composite: string): BlendMode {
  const name = composite.replace(/^svg:/, '')
  return BLEND_MODES.find(mode => mode === name) ?? 'normal'
}

function nodeOf(layer: Layer, pixels: Map<string, string>): OraNode | null {
  const shared = {
    name: layer.name,
    x: Math.round(layer.transform.x),
    y: Math.round(layer.transform.y),
    opacity: layer.opacity,
    visible: layer.visible,
    composite: compositeOf(layer.blend),
  }

  if (isGroup(layer)) {
    return {
      ...shared,
      kind: 'group',
      isolation: layer.isolation === 'isolate' ? 'isolate' : 'auto',
      children: nodesOf(layer.children, pixels),
    }
  }

  // An adjustment and a text layer have no element in the standard, and no surface to stand in
  // for them: they ride in `studio` alone. The flatten already shows what they did.
  if (layer.kind !== 'pixel') return null

  return {
    ...shared,
    kind: 'layer',
    src: pathOf(layer.id, false),
    png: pixels.get(pathOf(layer.id, false)) ?? '',
  }
}

/** Top first, undoing the studio's bottom-first order — the format writes a stack the other way. */
function nodesOf(layers: readonly Layer[], pixels: Map<string, string>): OraNode[] {
  return [...layers]
    .reverse()
    .map(layer => nodeOf(layer, pixels))
    .filter((node): node is OraNode => node !== null)
}

const layerPaths = (nodes: readonly OraNode[]): string[] =>
  nodes.flatMap(node => (isOraGroup(node) ? layerPaths(node.children) : [node.src]))

/**
 * The document as OpenRaster holds it, plus what OpenRaster cannot.
 *
 * `studio` carries the whole state verbatim rather than a diff of what the stack could not say:
 * reading it back is then one `deserializeCanvas`, and no rule has to be kept in step on two
 * sides. What the standard part is for is the OTHER reader — the one that will never know this
 * field exists.
 */
export function oraDocumentOf(
  state: CanvasState,
  pixels: readonly LayerPixels[],
  merged: string,
): OraDocument {
  const byPath = new Map(pixels.map(one => [pathOf(one.layerId, one.mask), one.data]))
  const nodes = nodesOf(state.layers, byPath)
  const named = new Set(layerPaths(nodes))

  return {
    width: state.width,
    height: state.height,
    nodes,
    merged,
    studio: serializeCanvas(state),
    extras: Object.fromEntries([...byPath].filter(([path]) => !named.has(path))),
  }
}

const pixelsFromPath = (path: string, data: string): LayerPixels | null => {
  const match = /^data\/([pm])_(.+)\.png$/.exec(path)
  return match?.[2] ? { layerId: match[2], mask: match[1] === 'm', data } : null
}

function pixelsOf(document: OraDocument): LayerPixels[] {
  const flat = (nodes: readonly OraNode[]): OraLayer[] =>
    nodes.flatMap(node => (isOraGroup(node) ? flat(node.children) : [node]))

  return [
    ...flat(document.nodes).map((layer): [string, string] => [layer.src, layer.png]),
    ...Object.entries(document.extras),
  ]
    .map(([path, data]) => pixelsFromPath(path, data))
    .filter((one): one is LayerPixels => one !== null && one.data !== '')
}

/**
 * A stack the studio never wrote, turned into layers it can edit. Bottom first again, and each
 * layer given the id its file already names so its pixels find it.
 */
function layersFromNodes(nodes: readonly OraNode[], at = { next: 0 }): Layer[] {
  return [...nodes].reverse().map((node): Layer => {
    at.next += 1
    const shared = {
      ...layerBase(`ora-${at.next}`, node.name),
      visible: node.visible,
      opacity: node.opacity,
      blend: blendOf(node.composite),
      transform: { ...IDENTITY, x: node.x, y: node.y },
    }

    if (!isOraGroup(node)) {
      const pixel: PixelLayer = { ...shared, kind: 'pixel' }
      return pixel
    }

    const group: GroupLayer = {
      ...shared,
      kind: 'group',
      children: layersFromNodes(node.children, at),
      collapsed: false,
      isolation: node.isolation === 'isolate' ? 'isolate' : 'pass-through',
    }
    return group
  })
}

/** The pixels of a foreign file, keyed to the ids `layersFromNodes` has just invented. */
function foreignPixels(nodes: readonly OraNode[], layers: readonly Layer[]): LayerPixels[] {
  const pairs: LayerPixels[] = []
  const walk = (theirs: readonly OraNode[], ours: readonly Layer[]): void => {
    const reversed = [...theirs].reverse()
    reversed.forEach((node, index) => {
      const layer = ours[index]
      if (!layer) return
      if (isOraGroup(node) && isGroup(layer)) return walk(node.children, layer.children)
      if (!isOraGroup(node) && node.png)
        pairs.push({ layerId: layer.id, mask: false, data: node.png })
    })
  }

  walk(nodes, layers)
  return pairs
}

/**
 * What reopening a `.ora` gives back.
 *
 * Two answers, and which one applies is whether the file has been here before: a container this
 * studio wrote restores its own state exactly, and one from anywhere else is rebuilt from the
 * standard part — with everything the standard cannot say simply absent, rather than the file
 * being refused.
 */
export function canvasFromOra(document: OraDocument): {
  state: CanvasState
  pixels: LayerPixels[]
} {
  if (document.studio) {
    return { state: deserializeCanvas(document.studio), pixels: pixelsOf(document) }
  }

  const layers = layersFromNodes(document.nodes)

  return {
    state: {
      ...deserializeCanvas('{}'),
      width: document.width,
      height: document.height,
      layers,
      activeLayerId: layers[layers.length - 1]?.id ?? null,
    },
    pixels: foreignPixels(document.nodes, layers),
  }
}
