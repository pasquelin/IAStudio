import {
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
  Mesh,
  type Group,
  type Material,
} from 'three'
import type { HeightmapSamples } from '@shared/domain/heightmap'
import { clamp } from '@shared/numeric'
import { chunkLayout, overlayDeltaReader, type ReliefChunkLayout } from '@shared/domain/relief'
import type { TerrainEditLayer } from '@shared/domain/scene'
import { rootColour } from '../core/palette'
import type { ReliefGeometryData } from './reliefBuildMessage'

type OverlayHost = {
  material: Material
  group: Group
  meshes: Map<string, Mesh>
}

export function addReliefChunk(
  host: OverlayHost,
  data: ReliefGeometryData,
  samples: HeightmapSamples,
  grain: number,
  edits: readonly TerrainEditLayer[],
): void {
  const geometry = new BufferGeometry()
  geometry.setAttribute(
    'position',
    new BufferAttribute(data.position, 3).setUsage(DynamicDrawUsage),
  )
  geometry.setAttribute('normal', new BufferAttribute(data.normal, 3).setUsage(DynamicDrawUsage))
  geometry.setAttribute('uv', new BufferAttribute(data.uv, 2))
  geometry.setIndex(new BufferAttribute(data.index, 1))
  writeMaskOverlay(
    geometry,
    samples,
    chunkLayout(data.column, data.row, samples.width, samples.height, grain),
    grain,
    edits,
  )
  const mesh = new Mesh(geometry, host.material)
  mesh.name = `relief-chunk-${data.column}-${data.row}`
  mesh.castShadow = false
  mesh.receiveShadow = true
  host.group.add(mesh)
  host.meshes.set(`${data.column}:${data.row}`, mesh)
}

/** Vertex tint of a painted mask: white where the stencil is empty, accent where it is full. */
export function writeMaskOverlay(
  geometry: BufferGeometry,
  samples: HeightmapSamples,
  layout: ReliefChunkLayout,
  grain: number,
  edits: readonly TerrainEditLayer[],
): void {
  const vertices = layout.width * layout.height
  const color = colorAttribute(geometry, vertices)
  const into = color.array
  if (!(into instanceof Float32Array)) return
  const [red, green, blue] = accentRgb()
  const weightAt = paintedOverlayAt(edits, samples, grain)
  for (let z = 0; z < layout.height; z++) {
    for (let x = 0; x < layout.width; x++) {
      const weight = weightAt(layout.sampleX + x, layout.sampleZ + z)
      const at = (z * layout.width + x) * 3
      into[at] = 1 - weight + weight * red
      into[at + 1] = 1 - weight + weight * green
      into[at + 2] = 1 - weight + weight * blue
    }
  }
  color.addUpdateRange(0, vertices * 3)
  color.needsUpdate = true
}

function paintedOverlayAt(
  edits: readonly TerrainEditLayer[],
  samples: HeightmapSamples,
  grain: number,
): (sx: number, sz: number) => number {
  const readers = edits.flatMap(edit =>
    edit.enabled && edit.mask?.kind === 'painted'
      ? [overlayDeltaReader(samples, grain, edit.mask.weights)]
      : [],
  )
  return (sx, sz) => {
    let peak = 0
    for (const read of readers) {
      const weight = clamp(read(sx, sz), 0, 1)
      if (weight > peak) peak = weight
    }
    return peak
  }
}

function colorAttribute(geometry: BufferGeometry, vertices: number): BufferAttribute {
  const held = geometry.getAttribute('color')
  if (held instanceof BufferAttribute && held.array.length === vertices * 3) return held
  const next = new BufferAttribute(new Float32Array(vertices * 3), 3).setUsage(DynamicDrawUsage)
  geometry.setAttribute('color', next)
  return next
}

function accentRgb(): [number, number, number] {
  const value = rootColour('--color-accent')
  const hex = value.startsWith('#') ? Number.parseInt(value.slice(1), 16) : 0
  return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255]
}
