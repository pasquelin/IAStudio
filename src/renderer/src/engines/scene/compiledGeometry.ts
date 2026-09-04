import { BufferAttribute, BufferGeometry, type InterleavedBufferAttribute } from 'three'
import { bytesFromBase64, bytesToBase64 } from '@shared/base64'
import type { CompiledMeshGeometry } from '@shared/domain/gameExport'

export function compiledMeshOf(geometry: BufferGeometry): CompiledMeshGeometry {
  const index = geometry.getIndex()
  return {
    position: floatAttributeBase64(geometry.getAttribute('position')),
    normal: floatAttributeBase64(geometry.getAttribute('normal')),
    uv: floatAttributeBase64(geometry.getAttribute('uv')),
    ...(index ? { index: attributeBase64(index) } : {}),
    ...(geometry.getAttribute('tangent')
      ? { tangent: floatAttributeBase64(geometry.getAttribute('tangent')) }
      : {}),
    ...(geometry.getAttribute('color')
      ? { color: floatAttributeBase64(geometry.getAttribute('color')) }
      : {}),
  }
}

export function geometryOfCompiledMesh(mesh: CompiledMeshGeometry): BufferGeometry {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(floatsFrom(mesh.position), 3))
  if (mesh.normal) geometry.setAttribute('normal', new BufferAttribute(floatsFrom(mesh.normal), 3))
  if (mesh.uv) geometry.setAttribute('uv', new BufferAttribute(floatsFrom(mesh.uv), 2))
  if (mesh.tangent)
    geometry.setAttribute('tangent', new BufferAttribute(floatsFrom(mesh.tangent), 4))
  if (mesh.color) geometry.setAttribute('color', new BufferAttribute(floatsFrom(mesh.color), 3))
  if (mesh.index) geometry.setIndex(new BufferAttribute(uintsFrom(mesh.index), 1))
  return geometry
}

function attributeBase64(attribute: BufferAttribute): string {
  return bytesToBase64(
    new Uint8Array(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength),
  )
}

function floatAttributeBase64(
  attribute: BufferAttribute | InterleavedBufferAttribute | undefined,
): string {
  if (!attribute) return ''
  if (attribute instanceof BufferAttribute) return attributeBase64(attribute)

  const values = new Float32Array(attribute.count * attribute.itemSize)
  for (let item = 0; item < attribute.count; item += 1) {
    for (let component = 0; component < attribute.itemSize; component += 1) {
      values[item * attribute.itemSize + component] = attribute.getComponent(item, component)
    }
  }
  return attributeBase64(new BufferAttribute(values, attribute.itemSize))
}

function floatsFrom(encoded: string): Float32Array {
  const bytes = bytesFromBase64(encoded)
  return new Float32Array(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength / Float32Array.BYTES_PER_ELEMENT,
  )
}

function uintsFrom(encoded: string): Uint32Array {
  const bytes = bytesFromBase64(encoded)
  return new Uint32Array(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength / Uint32Array.BYTES_PER_ELEMENT,
  )
}
