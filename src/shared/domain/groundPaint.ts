import type { ReliefExtent } from './relief'
import { clamp } from '../numeric'

export type GroundPaint = {
  width: number
  height: number
  pixels: Uint8ClampedArray
}

export type GroundPaintDisk = {
  x: number
  z: number
  radius: number
  amount: number
  falloff: number
  color: readonly [number, number, number, number]
}

export function emptyGroundPaint(width: number, height: number): GroundPaint {
  return { width, height, pixels: new Uint8ClampedArray(width * height * 4) }
}

export function paintGroundDisk(
  before: GroundPaint,
  extent: ReliefExtent,
  disk: GroundPaintDisk,
): GroundPaint {
  const pixels = before.pixels.slice()
  const stepX = extent.size.x / Math.max(1, before.width - 1)
  const stepZ = extent.size.z / Math.max(1, before.height - 1)
  const minX = clamp(Math.floor((disk.x - disk.radius - extent.origin.x) / stepX), 0, before.width)
  const maxX = clamp(
    Math.ceil((disk.x + disk.radius - extent.origin.x) / stepX),
    0,
    before.width - 1,
  )
  const minZ = clamp(Math.floor((disk.z - disk.radius - extent.origin.z) / stepZ), 0, before.height)
  const maxZ = clamp(
    Math.ceil((disk.z + disk.radius - extent.origin.z) / stepZ),
    0,
    before.height - 1,
  )

  for (let z = minZ; z <= maxZ; z += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const distance = Math.hypot(
        extent.origin.x + x * stepX - disk.x,
        extent.origin.z + z * stepZ - disk.z,
      )
      if (distance > disk.radius) continue
      const edge = disk.radius === 0 ? 1 : 1 - distance / disk.radius
      const strength = clamp(disk.amount * (disk.falloff === 0 ? 1 : edge ** disk.falloff), 0, 1)
      const offset = (z * before.width + x) * 4
      const [red, green, blue, alpha] = disk.color
      pixels[offset] = blend(pixels[offset], red, strength)
      pixels[offset + 1] = blend(pixels[offset + 1], green, strength)
      pixels[offset + 2] = blend(pixels[offset + 2], blue, strength)
      pixels[offset + 3] = blend(pixels[offset + 3], alpha, strength)
    }
  }
  return { ...before, pixels }
}

function blend(before: number | undefined, after: number, strength: number): number {
  return Math.round((before ?? 0) * (1 - strength) + after * strength)
}
