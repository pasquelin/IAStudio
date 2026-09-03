export type VisualFrame = { width: number; height: number; pixels: Uint8Array }

export type VisualRegressionOptions = {
  channelTolerance: number
  maximumChangedPixelRatio: number
}

export type VisualRegressionResult = {
  changedPixels: number
  changedPixelRatio: number
  maximumChannelDifference: number
  equivalent: boolean
}

export function compareVisualFrames(
  original: VisualFrame,
  optimized: VisualFrame,
  options: VisualRegressionOptions,
): VisualRegressionResult {
  if (
    !Number.isInteger(options.channelTolerance) ||
    options.channelTolerance < 0 ||
    options.channelTolerance > 255 ||
    !Number.isFinite(options.maximumChangedPixelRatio) ||
    options.maximumChangedPixelRatio < 0 ||
    options.maximumChangedPixelRatio > 1
  )
    throw new Error('Visual regression tolerances are outside their valid range')
  if (!sameDimensions(original, optimized) || !bothFramesComplete(original, optimized))
    throw new Error('Visual frames must have equal non-empty RGBA dimensions')

  let changedPixels = 0
  let maximumChannelDifference = 0
  for (let offset = 0; offset < original.pixels.length; offset += 4) {
    let changed = false
    for (let channel = 0; channel < 4; channel += 1) {
      const difference = Math.abs(
        (original.pixels[offset + channel] ?? 0) - (optimized.pixels[offset + channel] ?? 0),
      )
      maximumChannelDifference = Math.max(maximumChannelDifference, difference)
      if (difference > options.channelTolerance) changed = true
    }
    if (changed) changedPixels += 1
  }
  const pixels = original.width * original.height
  const changedPixelRatio = changedPixels / pixels
  return {
    changedPixels,
    changedPixelRatio,
    maximumChannelDifference,
    equivalent: changedPixelRatio <= options.maximumChangedPixelRatio,
  }
}

function sameDimensions(original: VisualFrame, optimized: VisualFrame): boolean {
  return original.width === optimized.width && original.height === optimized.height
}

function bothFramesComplete(original: VisualFrame, optimized: VisualFrame): boolean {
  return completeFrame(original) && completeFrame(optimized)
}

function completeFrame(frame: VisualFrame): boolean {
  return (
    frame.width > 0 && frame.height > 0 && frame.pixels.length === frame.width * frame.height * 4
  )
}
