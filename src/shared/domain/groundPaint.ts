import type { ReliefExtent } from './relief'
import type { GroundMaterialChannel } from './scene'
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

export function emptyGroundWeights(width: number, height: number): GroundPaint {
  const paint = emptyGroundPaint(width, height)
  for (let offset = 0; offset < paint.pixels.length; offset += 4) paint.pixels[offset] = 255
  return paint
}

export function paintGroundChannelDisk(
  before: GroundPaint,
  extent: ReliefExtent,
  disk: Omit<GroundPaintDisk, 'color'>,
  channel: GroundMaterialChannel,
): GroundPaint {
  const color: [number, number, number, number] = [0, 0, 0, 0]
  color[channelOffset(channel)] = 255
  return paintGroundDisk(before, extent, { ...disk, color }, channelOffset(channel))
}

export function paintGroundDisk(
  before: GroundPaint,
  extent: ReliefExtent,
  disk: GroundPaintDisk,
  onlyChannel?: number,
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
      const colors = [red, green, blue, alpha]
      for (let channel = 0; channel < 4; channel += 1) {
        if (onlyChannel !== undefined && channel !== onlyChannel) continue
        pixels[offset + channel] = blend(pixels[offset + channel], colors[channel] ?? 0, strength)
      }
    }
  }
  return { ...before, pixels }
}

function channelOffset(channel: GroundMaterialChannel): number {
  return channel === 'r' ? 0 : channel === 'g' ? 1 : channel === 'b' ? 2 : 3
}

function blend(before: number | undefined, after: number, strength: number): number {
  return Math.round((before ?? 0) * (1 - strength) + after * strength)
}
