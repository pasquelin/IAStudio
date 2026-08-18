/**
 * OpenRaster, as this studio writes and reads it.
 *
 * The open format for a layered picture: a ZIP holding one PNG per layer, a `stack.xml` naming
 * them, and a flattened `mergedimage.png` the spec requires — which is what lets a `.ora` be
 * both the work and its own preview, where a `.png` beside a document could only be one of them.
 *
 * What the standard cannot carry rides in `studio` and is invisible to any other application.
 * `formatCapability.ts` says which traits fall on which side, and that split is the contract:
 * promising a whole round trip through another editor would be a lie this type has to prevent.
 */

/** The mimetype the spec demands as the container's first, uncompressed entry. */
export const ORA_MIMETYPE = 'image/openraster'

/** The version this studio writes. `mergedimage.png` became mandatory here. */
export const ORA_VERSION = '0.0.3'

/** Where the studio's own state rides inside the container. */
export const ORA_STUDIO_PATH = 'scenario/document.json'

/**
 * The document's envelope — who it is, and which asset it edits — inside the container.
 *
 * Written SECOND, right after `mimetype`, and uncompressed: a listing reads the first few
 * kilobytes of the file and stops, where reading the whole of it would inflate every layer of
 * every picture in the project. The same trick as an enveloped document's first line, in the one
 * place a ZIP allows it.
 *
 * A container from another application has none, and that is not a failure: it has no identity
 * of ours to carry, so it is known by its file name exactly as a pre-version-3 document is.
 */
export const ORA_ENVELOPE_PATH = 'scenario/envelope.json'

/** How much of a container is read to find that envelope. */
export const ORA_HEAD_LIMIT = 64 * 1024

/** The flatten, at the container's root, where every other application looks for it. */
export const ORA_MERGED_PATH = 'mergedimage.png'

/**
 * Where a surface may sit inside the container, and the only shapes one may have.
 *
 * The one spelling of it: the IPC boundary refuses anything else, the window names its layers
 * through it, and the packer trusts it. One flat segment under `data/`, or the flatten's own
 * reserved name — no separator can be spelled with those characters, so no entry cleared here
 * can name a path, and none of them can escape the container on the way back out.
 */
export function isOraSurfacePath(path: string): boolean {
  return path === ORA_MERGED_PATH || /^data\/[\w.-]+\.png$/.test(path)
}

/** What every node of a stack carries, layer or group alike. */
export type OraNodeBase = {
  name: string
  /** Integer offsets — the only placement OpenRaster carries. */
  x: number
  y: number
  /** 0 to 1. */
  opacity: number
  visible: boolean
  /** An SVG compositing operation, `svg:src-over` for a plain layer. */
  composite: string
}

export type OraLayer = OraNodeBase & {
  kind: 'layer'
  /**
   * Which surface holds this layer's pixels — `data/…png`, never the pixels themselves.
   *
   * The stack is a description and it is written as JSON: an image document's `content` IS this
   * tree. Bytes travel beside it, so nothing base64-encodes a 4K layer to put it in a string.
   */
  src: string
}

export type OraGroup = OraNodeBase & {
  kind: 'group'
  /** `isolate` cuts the group off from what is under it, as it does in the studio. */
  isolation: 'auto' | 'isolate'
  children: readonly OraNode[]
}

export type OraNode = OraLayer | OraGroup

/**
 * What `stack.xml` says, plus what the standard cannot say. Serializable as JSON, which is what
 * lets an image document's `content` be exactly this and its pixels travel beside it.
 */
export type OraStack = {
  width: number
  height: number
  /** TOP first, which is the order OpenRaster writes a stack in — the studio stores it bottom first. */
  nodes: readonly OraNode[]
  /** The studio's own serialized state, carried verbatim. Empty for a file written elsewhere. */
  studio: string
}

/**
 * One surface of the container: a layer's pixels, a mask, or the flatten at `mergedimage.png`.
 *
 * Everything under `data/` that no `<layer>` names comes back too — masks, and the surfaces of
 * layers the standard has no element for. Another application ignores them; this one needs them
 * to reopen the document whole, which is the whole point of the split `formatCapability` draws.
 */
export type OraSurface = {
  /** Where it sits in the container. `isOraSurfacePath` is what it is held to. */
  path: string
  png: Uint8Array
}

export type OraDocument = {
  stack: OraStack
  surfaces: readonly OraSurface[]
}

export const isOraGroup = (node: OraNode): node is OraGroup => node.kind === 'group'
