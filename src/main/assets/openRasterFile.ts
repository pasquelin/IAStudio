import {
  strFromU8,
  strToU8,
  Unzip,
  UnzipInflate,
  unzipSync,
  zipSync,
  type Zippable,
} from 'fflate'
import {
  isOraGroup,
  isOraSurfacePath,
  ORA_ENVELOPE_PATH,
  ORA_MERGED_PATH,
  ORA_MIMETYPE,
  ORA_STUDIO_PATH,
  ORA_VERSION,
  type OraDocument,
  type OraGroup,
  type OraNode,
  type OraNodeBase,
  type OraStack,
  type OraSurface,
} from '@shared/domain/openRaster'

const MIMETYPE_PATH = 'mimetype'
const THUMBNAIL_PATH = 'Thumbnails/thumbnail.png'
const STACK_PATH = 'stack.xml'

const escapeXml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

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

function stackXml(stack: OraStack): string {
  return [
    `<?xml version='1.0' encoding='UTF-8'?>`,
    `<image version="${ORA_VERSION}" w="${stack.width}" h="${stack.height}">`,
    `  <stack>`,
    ...stack.nodes.map(node => nodeXml(node, 2)),
    `  </stack>`,
    `</image>`,
    '',
  ].join('\n')
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
 *
 * A surface whose path this file would not have written is DROPPED rather than written where it
 * says: these come across a boundary, and an entry naming its way out of the container would be
 * written back out by whoever unpacks one.
 */
export function packOpenRaster({ stack, surfaces }: OraDocument, envelope = ''): Uint8Array {
  const files: Zippable = {
    [MIMETYPE_PATH]: [strToU8(ORA_MIMETYPE), { level: 0 }],
    // Second, and stored: `oraEnvelopeIn` reads it out of the head of the file alone.
    ...(envelope ? { [ORA_ENVELOPE_PATH]: stored(strToU8(envelope)) } : {}),
    [STACK_PATH]: strToU8(stackXml(stack)),
  }

  for (const surface of surfaces) {
    if (!isOraSurfacePath(surface.path) || surface.png.byteLength === 0) continue
    files[surface.path] = stored(surface.png)
    // The spec asks for a thumbnail, and the flatten is the only picture this process holds.
    if (surface.path === ORA_MERGED_PATH) files[THUMBNAIL_PATH] = stored(surface.png)
  }

  if (stack.studio) files[ORA_STUDIO_PATH] = strToU8(stack.studio)

  return zipSync(files)
}

/**
 * A PNG goes in UNCOMPRESSED, and that is a performance decision rather than a lazy one.
 *
 * `zipSync` deflates on the thread that owns every window, so a document of several 4K layers
 * would freeze the whole studio for seconds on each ⌘S — invariant 6. A PNG is already deflated
 * inside, so a second pass buys a percent or two for that entire cost. Only `stack.xml` and the
 * studio's state are compressed, and both are text measured in kilobytes.
 */
const stored = (png: Uint8Array): [Uint8Array, { level: 0 }] => [png, { level: 0 }]

/**
 * Anchored on whitespace, and that is not pedantry: unanchored, `y="…"` matches inside
 * `opacity="…"`. Writers that emit attributes alphabetically — GIMP and MyPaint do — put
 * `opacity` first, so every layer of a file from either landed at the wrong height. Ours emits
 * `y` before `opacity`, which is exactly why a round trip through this studio never showed it.
 */
const attribute = (tag: string, name: string): string =>
  new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(tag)?.[1] ?? ''

const unescapeXml = (text: string): string =>
  text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')

function baseFrom(tag: string): OraNodeBase {
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
function readNodes(xml: string): OraNode[] {
  const tags = xml.matchAll(/<(layer|stack)\b([^>]*?)(\/?)>|<\/stack>/g)
  const roots: OraNode[] = []
  // The outermost `<stack>` is the image's own, so children land in `roots` until one nests.
  const open: OraGroup[] = []
  const push = (node: OraNode): void => {
    const parent = open[open.length - 1]
    // `children` is published readonly and filled while the file is walked: the tree is built
    // once here, and nothing outside this function ever holds a node before it is finished.
    if (parent) (parent.children as OraNode[]).push(node)
    else roots.push(node)
  }

  let rootSeen = false

  for (const [tag, kind, , selfClosing] of tags) {
    if (!kind) {
      open.pop()
      continue
    }
    if (kind === 'layer') {
      push({ ...baseFrom(tag), kind: 'layer', src: unescapeXml(attribute(tag, 'src')) })
      continue
    }
    // The FIRST `<stack>` is the image's own and wraps everything: it is not a group. Recognised
    // by position, never by having no name — Krita and the spec's own example write it as
    // `name="root"`, and sniffing for a name imported those files as one group called « root ».
    if (!rootSeen) {
      rootSeen = true
      continue
    }

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

/** What the first kilobytes of a container say about it, without a word of the layers in it. */
export type OraHead = {
  /** `image/openraster` for a container. Anything else is a file that only wears the extension. */
  mimetype: string
  /** The studio's own envelope, or the empty string — every container written elsewhere has none. */
  envelope: string
}

/**
 * The head of a container — its first entries alone, streamed, without the central directory and
 * without inflating a single layer.
 *
 * An empty `mimetype` for bytes that are not a container at all, which is what tells a real
 * `.ora` from a file that only wears the extension. Identified the way the spec says to: the
 * first entry, stored, holding the media type.
 *
 * **The blind spot, in clear**: a container whose writer left `mimetype` out — which the spec
 * forbids and GIMP, Krita and MyPaint all honour — reads here as "not a container", and the
 * document drops out of every listing while sitting in the folder.
 */
export function oraHeadIn(head: Uint8Array): OraHead {
  const found = new Map<string, Uint8Array[]>()
  // The stream hands over what it has, whether or not the entry ENDED inside the buffer — a head
  // cut mid-envelope answers half a JSON object with no error at all, which parses as nothing
  // and would cost the document its identity in silence. Only a finished entry is an answer.
  const whole = new Set<string>()

  const reader = new Unzip(entry => {
    if (entry.name !== ORA_ENVELOPE_PATH && entry.name !== MIMETYPE_PATH) return
    const chunks: Uint8Array[] = []
    found.set(entry.name, chunks)
    entry.ondata = (_error, chunk, final) => {
      chunks.push(chunk)
      if (final) whole.add(entry.name)
    }
    entry.start()
  })
  reader.register(UnzipInflate)

  try {
    // Never final: the buffer STOPS mid-file by design, and saying otherwise asks the reader for
    // a central directory that is megabytes further on.
    reader.push(head, false)
  } catch {
    return { mimetype: '', envelope: '' }
  }

  const textOf = (path: string): string =>
    whole.has(path) ? strFromU8(concatBytes(found.get(path) ?? [])) : ''

  return { mimetype: textOf(MIMETYPE_PATH), envelope: textOf(ORA_ENVELOPE_PATH) }
}

function concatBytes(chunks: readonly Uint8Array[]): Uint8Array {
  const whole = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0))
  let at = 0
  for (const chunk of chunks) {
    whole.set(chunk, at)
    at += chunk.byteLength
  }
  return whole
}

/**
 * The flatten alone, for a reader that wants a picture rather than a document — `null` for bytes
 * that are not a container.
 *
 * `filter` so the layers are never inflated: this answers the asset scheme, which is asked once
 * per tile of a grid, and a shelf of layered pictures would otherwise decompress every layer of
 * every one of them to draw a thumbnail.
 */
export function mergedPictureOf(bytes: Uint8Array): Uint8Array | null {
  try {
    return (
      unzipSync(bytes, { filter: entry => entry.name === ORA_MERGED_PATH })[ORA_MERGED_PATH] ?? null
    )
  } catch {
    return null
  }
}

/**
 * Throws on anything that is not a container — a caller has to tell that from an empty one.
 *
 * Every surface comes back, whether a `<layer>` names it or not: a mask and an adjustment layer's
 * pixels have no element in the standard, and dropping the ones nothing points at would lose
 * exactly what this studio needs to reopen its own work.
 */
export function unpackOpenRaster(bytes: Uint8Array): OraDocument {
  const entries = unzipSync(bytes)
  const xml = entries[STACK_PATH]
  if (!xml) throw new Error('not an OpenRaster container: no stack.xml')

  const image = strFromU8(xml)
  const studio = entries[ORA_STUDIO_PATH]

  const surfaces: OraSurface[] = []
  for (const [path, png] of Object.entries(entries)) {
    if (isOraSurfacePath(path)) surfaces.push({ path, png })
  }

  return {
    stack: {
      width: Number(attribute(image, 'w')) || 0,
      height: Number(attribute(image, 'h')) || 0,
      nodes: readNodes(image),
      studio: studio ? strFromU8(studio) : '',
    },
    surfaces,
  }
}
