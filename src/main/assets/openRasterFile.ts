import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate'
import {
  ORA_MIMETYPE,
  ORA_STUDIO_PATH,
  ORA_VERSION,
  isOraGroup,
  type OraDocument,
  type OraGroup,
  type OraLayer,
  type OraNode,
} from '@shared/domain/openRaster'

const MERGED_PATH = 'mergedimage.png'
const THUMBNAIL_PATH = 'Thumbnails/thumbnail.png'
const STACK_PATH = 'stack.xml'

const escapeXml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const base64ToBytes = (base64: string): Uint8Array => Uint8Array.from(Buffer.from(base64, 'base64'))

const bytesToBase64 = (bytes: Uint8Array): string => Buffer.from(bytes).toString('base64')

/** The attributes every node writes, whichever kind it is. */
function commonAttributes(node: OraNode): string {
  return (
    `name="${escapeXml(node.name)}" x="${Math.round(node.x)}" y="${Math.round(node.y)}" ` +
    `opacity="${node.opacity}" visibility="${node.visible ? 'visible' : 'hidden'}" ` +
    `composite-op="${escapeXml(node.composite)}"`
  )
}

function nodeXml(node: OraNode, depth: number): string {
  const pad = '  '.repeat(depth)
  if (!isOraGroup(node)) {
    return `${pad}<layer ${commonAttributes(node)} src="${escapeXml(node.src)}"/>`
  }

  return [
    `${pad}<stack ${commonAttributes(node)} isolation="${node.isolation}">`,
    ...node.children.map(child => nodeXml(child, depth + 1)),
    `${pad}</stack>`,
  ].join('\n')
}

function stackXml(document: OraDocument): string {
  return [
    `<?xml version='1.0' encoding='UTF-8'?>`,
    `<image version="${ORA_VERSION}" w="${document.width}" h="${document.height}">`,
    `  <stack>`,
    ...document.nodes.map(node => nodeXml(node, 2)),
    `  </stack>`,
    `</image>`,
    '',
  ].join('\n')
}

function collectLayers(nodes: readonly OraNode[]): OraLayer[] {
  return nodes.flatMap(node => (isOraGroup(node) ? collectLayers(node.children) : [node]))
}

/**
 * The container, as bytes.
 *
 * `mimetype` goes in FIRST and uncompressed — the one structural rule of the format, and the one
 * whose breach makes the file open nowhere with nothing to say why.
 *
 * The thumbnail is the flatten again rather than a downscale: resizing belongs to a graphics
 * context, which the main process has none of, and a thumbnail no bigger than the picture is
 * within spec. It is what stops a file manager showing a blank tile.
 */
export function packOpenRaster(document: OraDocument): Uint8Array {
  const files: Zippable = {
    mimetype: [strToU8(ORA_MIMETYPE), { level: 0 }],
    [STACK_PATH]: strToU8(stackXml(document)),
    [MERGED_PATH]: base64ToBytes(document.merged),
    [THUMBNAIL_PATH]: base64ToBytes(document.merged),
  }

  for (const layer of collectLayers(document.nodes)) files[layer.src] = base64ToBytes(layer.png)
  for (const [path, png] of Object.entries(document.extras)) files[path] = base64ToBytes(png)
  if (document.studio) files[ORA_STUDIO_PATH] = strToU8(document.studio)

  return zipSync(files)
}

const attribute = (tag: string, name: string): string =>
  new RegExp(`${name}="([^"]*)"`).exec(tag)?.[1] ?? ''

const unescapeXml = (text: string): string =>
  text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')

function baseFrom(tag: string): Omit<OraLayer, 'kind' | 'src' | 'png'> {
  return {
    name: unescapeXml(attribute(tag, 'name')),
    x: Number(attribute(tag, 'x')) || 0,
    y: Number(attribute(tag, 'y')) || 0,
    opacity: attribute(tag, 'opacity') === '' ? 1 : Number(attribute(tag, 'opacity')),
    visible: attribute(tag, 'visibility') !== 'hidden',
    composite: unescapeXml(attribute(tag, 'composite-op')) || 'svg:src-over',
  }
}

/**
 * The stack, walked from the tag stream rather than through a DOM: the main process has no
 * parser, and `stack.xml` is a nesting of two element names with no text content between them.
 */
function readNodes(xml: string, pngOf: (src: string) => string): OraNode[] {
  const tags = xml.matchAll(/<(layer|stack)\b([^>]*?)(\/?)>|<\/stack>/g)
  const roots: OraNode[] = []
  // The outermost `<stack>` is the image's own, so children land in `roots` until one nests.
  const open: OraGroup[] = []
  const push = (node: OraNode): void => {
    const parent = open[open.length - 1]
    if (parent) (parent.children as OraNode[]).push(node)
    else roots.push(node)
  }

  for (const [tag, kind, , selfClosing] of tags) {
    if (!kind) {
      open.pop()
      continue
    }
    if (kind === 'layer') {
      const src = unescapeXml(attribute(tag, 'src'))
      push({ ...baseFrom(tag), kind: 'layer', src, png: pngOf(src) })
      continue
    }
    // The image's own `<stack>` carries no name and wraps everything: it is not a group.
    if (!/\bname=/.test(tag)) continue

    const group: OraGroup = {
      ...baseFrom(tag),
      kind: 'group',
      isolation: attribute(tag, 'isolation') === 'isolate' ? 'isolate' : 'auto',
      children: [],
    }
    push(group)
    if (!selfClosing) open.push(group)
  }

  return roots
}

/** Throws on anything that is not a container — a caller has to tell that from an empty one. */
export function unpackOpenRaster(bytes: Uint8Array): OraDocument {
  const entries = unzipSync(bytes)
  const xml = entries[STACK_PATH]
  if (!xml) throw new Error('not an OpenRaster container: no stack.xml')

  const stack = strFromU8(xml)
  const studio = entries[ORA_STUDIO_PATH]
  const merged = entries[MERGED_PATH]
  const nodes = readNodes(stack, src => {
    const png = entries[src]
    return png ? bytesToBase64(png) : ''
  })

  const named = new Set(collectLayers(nodes).map(layer => layer.src))
  const extras = Object.fromEntries(
    Object.entries(entries)
      .filter(([path]) => path.startsWith('data/') && !named.has(path))
      .map(([path, png]) => [path, bytesToBase64(png)]),
  )

  return {
    width: Number(attribute(stack, 'w')) || 0,
    height: Number(attribute(stack, 'h')) || 0,
    nodes,
    merged: merged ? bytesToBase64(merged) : '',
    studio: studio ? strFromU8(studio) : '',
    extras,
  }
}
