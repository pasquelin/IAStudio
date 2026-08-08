/**
 * A sky, on its way to a `.sky` file and back. The shape is `SkyboxContent`, which already
 * states what belongs on disk; this pair is only the crossing, and the read half is where a
 * file stops being trusted.
 */
import { readAdjustments } from '@shared/domain/adjustments'
import { clampElevation, normalizeAzimuth } from '@shared/domain/angles'
import {
  createSkyboxContent,
  DEFAULT_ENVIRONMENT,
  DEFAULT_SUN,
  type SkyboxContent,
} from '@shared/domain/skybox'
import { isRecord, readBoolean, readNumber, readString } from '@shared/guards'

export function serializeSkybox(content: SkyboxContent): string {
  return JSON.stringify(content)
}

function readSource(raw: unknown): SkyboxContent['source'] {
  if (!isRecord(raw)) return null
  const assetId = readString(raw, 'assetId', '')
  // An empty id resolves to no file, and the engine cannot tell that from a sky that is black.
  return assetId ? { assetId } : null
}

function readSun(raw: unknown): SkyboxContent['sun'] {
  if (!isRecord(raw)) return { ...DEFAULT_SUN }

  return {
    // Clamped and wrapped on the way in, exactly as a drag leaves them: an elevation at the
    // pole loses its azimuth, and `asin` of an out-of-range value poisons every later frame.
    elevation: clampElevation(readNumber(raw, 'elevation', DEFAULT_SUN.elevation)),
    azimuth: normalizeAzimuth(readNumber(raw, 'azimuth', DEFAULT_SUN.azimuth)),
    intensity: Math.max(0, readNumber(raw, 'intensity', DEFAULT_SUN.intensity)),
    color: readString(raw, 'color', DEFAULT_SUN.color),
  }
}

function readEnvironment(raw: unknown): SkyboxContent['environment'] {
  if (!isRecord(raw)) return { ...DEFAULT_ENVIRONMENT }

  return {
    intensity: Math.max(0, readNumber(raw, 'intensity', DEFAULT_ENVIRONMENT.intensity)),
    showBackground: readBoolean(raw, 'showBackground', DEFAULT_ENVIRONMENT.showBackground),
  }
}

/**
 * Provenance, or nothing. A model id is what makes the rest worth showing — a prompt credited
 * to no model names a picture the panel cannot offer to make again.
 */
function readGeneration(raw: unknown): SkyboxContent['generation'] {
  if (!isRecord(raw)) return undefined

  const modelId = readString(raw, 'modelId', '')
  if (!modelId) return undefined

  const seed = readNumber(raw, 'seed', Number.NaN)
  return {
    modelId,
    modelLabel: readString(raw, 'modelLabel', modelId),
    prompt: readString(raw, 'prompt', ''),
    ...(Number.isFinite(seed) ? { seed } : {}),
  }
}

/**
 * A sky read back from a file. Takes the parsed value rather than the text, like every other
 * document reader: text that is not JSON at all is a file that failed to read, and that is the
 * caller's to refuse — a shape that is merely wrong opens on an empty sky.
 */
export function parseSkybox(content: unknown): SkyboxContent {
  if (!isRecord(content)) return createSkyboxContent()

  const generation = readGeneration(content.generation)
  return {
    source: readSource(content.source),
    adjustments: readAdjustments(content.adjustments),
    sun: readSun(content.sun),
    environment: readEnvironment(content.environment),
    ...(generation ? { generation } : {}),
  }
}
