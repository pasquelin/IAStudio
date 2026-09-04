const GLB_MAGIC = 0x46546c67
const JSON_CHUNK = 0x4e4f534a
const BINARY_CHUNK = 0x004e4942
const UNSIGNED_SHORT = 5123
const UNSIGNED_INT = 5125

type JsonObject = Record<string, unknown>

type CompactView = {
  index: number
  offset: number
  length: number
  count: number
  accessor: JsonObject
  view: JsonObject
}

export function compactGlbGeometry(source: Uint8Array): Uint8Array {
  const parsed = parsedGlb(source)
  if (!parsed) return source
  const candidates = compactViewsOf(parsed.json, parsed.binary)
  if (candidates.length === 0) return source

  const binary = compactBinary(parsed.binary, candidates)
  updateOffsets(parsed.json, candidates)
  const result = encodedGlb(parsed.json, binary)
  return result.byteLength < source.byteLength ? result : source
}

function parsedGlb(source: Uint8Array): { json: JsonObject; binary: Uint8Array } | null {
  if (source.byteLength < 20) return null
  const data = new DataView(source.buffer, source.byteOffset, source.byteLength)
  if (data.getUint32(0, true) !== GLB_MAGIC || data.getUint32(4, true) !== 2) return null
  const jsonLength = data.getUint32(12, true)
  if (data.getUint32(16, true) !== JSON_CHUNK) return null
  const binaryHeader = 20 + jsonLength
  if (binaryHeader + 8 > source.byteLength) return null
  const binaryLength = data.getUint32(binaryHeader, true)
  if (data.getUint32(binaryHeader + 4, true) !== BINARY_CHUNK) return null
  if (binaryHeader + 8 + binaryLength !== source.byteLength) return null
  try {
    const decoded: unknown = JSON.parse(withoutChunkPadding(source.subarray(20, binaryHeader)))
    if (!isObject(decoded)) return null
    return {
      json: decoded,
      binary: source.subarray(binaryHeader + 8, binaryHeader + 8 + binaryLength),
    }
  } catch {
    return null
  }
}

function compactViewsOf(json: JsonObject, binary: Uint8Array): CompactView[] {
  const accessors = objectArray(json.accessors)
  const views = objectArray(json.bufferViews)
  const buffers = objectArray(json.buffers)
  if (!accessors || !views || buffers?.length !== 1 || buffers[0]?.uri !== undefined) return []
  const references = new Map<number, number>()
  for (const accessor of accessors) {
    const view = integer(accessor.bufferView)
    if (view !== null) references.set(view, (references.get(view) ?? 0) + 1)
  }
  const found = accessors.flatMap(accessor => {
    const candidate = compactViewOf(accessor, views, binary, references)
    return candidate ? [candidate] : []
  })
  return found.some(candidate =>
    views.some((view, index) => index !== candidate.index && overlaps(candidate, view)),
  )
    ? []
    : found
}

function compactViewOf(
  accessor: JsonObject,
  views: readonly JsonObject[],
  binary: Uint8Array,
  references: ReadonlyMap<number, number>,
): CompactView | null {
  const index = integer(accessor.bufferView)
  const count = integer(accessor.count)
  if (index === null || count === null || !isCompactAccessor(accessor, index, references))
    return null
  const view = views[index]
  if (!isCompactIndexView(view)) return null
  const offset = integer(view.byteOffset) ?? 0
  const length = integer(view.byteLength)
  if (length !== count * 4 || !fitsUnsignedShort(binary, offset, length, count)) return null
  return { index, offset, length, count, accessor, view }
}

function isCompactAccessor(
  accessor: JsonObject,
  index: number,
  references: ReadonlyMap<number, number>,
): boolean {
  return (
    accessor.componentType === UNSIGNED_INT &&
    accessor.type === 'SCALAR' &&
    accessor.byteOffset === undefined &&
    accessor.sparse === undefined &&
    accessor.extensions === undefined &&
    references.get(index) === 1
  )
}

function isCompactIndexView(view: JsonObject | undefined): view is JsonObject {
  return (
    view !== undefined &&
    (view.buffer === undefined || view.buffer === 0) &&
    view.target === 34963 &&
    view.extensions === undefined &&
    view.byteStride === undefined
  )
}

function fitsUnsignedShort(
  binary: Uint8Array,
  offset: number,
  length: number,
  count: number,
): boolean {
  if (offset + length > binary.byteLength) return false
  const values = new DataView(binary.buffer, binary.byteOffset + offset, length)
  for (let item = 0; item < count; item += 1) {
    if (values.getUint32(item * 4, true) > 65_535) return false
  }
  return true
}

function overlaps(candidate: CompactView, view: JsonObject): boolean {
  const offset = integer(view.byteOffset) ?? 0
  const length = integer(view.byteLength)
  return (
    length !== null &&
    offset < candidate.offset + candidate.length &&
    candidate.offset < offset + length
  )
}

function compactBinary(binary: Uint8Array, candidates: readonly CompactView[]): Uint8Array {
  const ordered = [...candidates].sort((left, right) => left.offset - right.offset)
  const removed = ordered.reduce((total, candidate) => total + removedBytes(candidate), 0)
  const result = new Uint8Array(binary.byteLength - removed)
  let sourceOffset = 0
  let targetOffset = 0
  for (const candidate of ordered) {
    const before = binary.subarray(sourceOffset, candidate.offset)
    result.set(before, targetOffset)
    targetOffset += before.byteLength
    const sourceValues = new DataView(
      binary.buffer,
      binary.byteOffset + candidate.offset,
      candidate.length,
    )
    const compactLength = candidate.count * 2
    const targetValues = new DataView(result.buffer, targetOffset, compactLength)
    for (let item = 0; item < candidate.count; item += 1) {
      targetValues.setUint16(item * 2, sourceValues.getUint32(item * 4, true), true)
    }
    targetOffset += alignedLength(compactLength)
    sourceOffset = candidate.offset + candidate.length
  }
  result.set(binary.subarray(sourceOffset), targetOffset)
  return result
}

function updateOffsets(json: JsonObject, candidates: readonly CompactView[]): void {
  const views = objectArray(json.bufferViews) ?? []
  const ordered = [...candidates].sort((left, right) => left.offset - right.offset)
  for (const candidate of ordered) {
    candidate.accessor.componentType = UNSIGNED_SHORT
    candidate.view.byteLength = candidate.count * 2
  }
  for (const view of views) {
    const offset = integer(view.byteOffset) ?? 0
    const removed = ordered
      .filter(candidate => candidate.offset < offset)
      .reduce((total, candidate) => total + removedBytes(candidate), 0)
    if (offset > 0 || removed > 0) view.byteOffset = offset - removed
  }
  const buffers = objectArray(json.buffers)
  if (buffers?.[0]) {
    const length = integer(buffers[0].byteLength)
    if (length !== null) {
      buffers[0].byteLength = length - ordered.reduce((total, one) => total + removedBytes(one), 0)
    }
  }
}

function encodedGlb(json: JsonObject, binary: Uint8Array): Uint8Array {
  const encodedJson = new TextEncoder().encode(JSON.stringify(json))
  const jsonLength = alignedLength(encodedJson.byteLength)
  const binaryLength = alignedLength(binary.byteLength)
  const result = new Uint8Array(12 + 8 + jsonLength + 8 + binaryLength)
  const data = new DataView(result.buffer)
  data.setUint32(0, GLB_MAGIC, true)
  data.setUint32(4, 2, true)
  data.setUint32(8, result.byteLength, true)
  data.setUint32(12, jsonLength, true)
  data.setUint32(16, JSON_CHUNK, true)
  result.fill(0x20, 20, 20 + jsonLength)
  result.set(encodedJson, 20)
  const binaryHeader = 20 + jsonLength
  data.setUint32(binaryHeader, binaryLength, true)
  data.setUint32(binaryHeader + 4, BINARY_CHUNK, true)
  result.set(binary, binaryHeader + 8)
  return result
}

function alignedLength(length: number): number {
  return Math.ceil(length / 4) * 4
}

function removedBytes(candidate: CompactView): number {
  return candidate.length - alignedLength(candidate.count * 2)
}

function withoutChunkPadding(bytes: Uint8Array): string {
  const decoded = new TextDecoder().decode(bytes)
  let end = decoded.length
  while (end > 0) {
    const last = decoded.charCodeAt(end - 1)
    if (last !== 0 && last !== 32) break
    end -= 1
  }
  return decoded.slice(0, end)
}

function objectArray(value: unknown): JsonObject[] | null {
  return Array.isArray(value) && value.every(isObject) ? value : null
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function integer(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null
}
