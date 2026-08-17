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
  /** Path inside the container, `data/…png`. */
  src: string
  /** Base64 PNG. Empty when a read asked for the stack alone. */
  png: string
}

export type OraGroup = OraNodeBase & {
  kind: 'group'
  /** `isolate` cuts the group off from what is under it, as it does in the studio. */
  isolation: 'auto' | 'isolate'
  children: readonly OraNode[]
}

export type OraNode = OraLayer | OraGroup

export type OraDocument = {
  width: number
  height: number
  /** TOP first, which is the order OpenRaster writes a stack in — the studio stores it bottom first. */
  nodes: readonly OraNode[]
  /** Base64 PNG: the flattened picture, required by the spec and read by everything else. */
  merged: string
  /** The studio's own serialized state, carried verbatim. Empty for a file written elsewhere. */
  studio: string
  /**
   * Pixels no `<layer>` names, by path: masks, and the surfaces of layers the standard has no
   * element for. Another application ignores them; this one needs them to reopen the document
   * whole, which is the whole point of the split `formatCapability` draws.
   */
  extras: Record<string, string>
}

export const isOraGroup = (node: OraNode): node is OraGroup => node.kind === 'group'
