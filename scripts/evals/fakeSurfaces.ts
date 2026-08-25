import type { ActionOutcome } from '@shared/domain/assistant'
import { answered, done, front, refused, type Bench } from './bench'
import { flag, number, text, type Input } from './inputs'

/**
 * The two spaces the batterie visits briefly: a sky and a material. The surface each needs is
 * already held by `fakeStudio`'s own gate, so nothing here checks it a second time.
 */

/** Whether a call named any dial at all — the studio answers on a change and never on none. */
const dialled = (input: Input, ...keys: string[]): boolean =>
  keys.some(key => input[key] !== undefined)

export function surfaceAction(bench: Bench, action: string, input: Input): ActionOutcome | null {
  const open = front(bench)
  if (!open) return null

  switch (action) {
    case 'skybox.state':
      return answered(open.skybox)

    case 'skybox.source': {
      const source = text(input, 'assetId')
      if (source === '') return refused('badInput')

      open.skybox.source = source
      open.modified = true
      return done
    }

    case 'skybox.sun': {
      if (!dialled(input, 'elevation', 'azimuth', 'intensity', 'color')) return refused('badInput')

      open.skybox.sunIntensity = number(input, 'intensity') ?? open.skybox.sunIntensity
      open.modified = true
      return done
    }

    case 'skybox.environment': {
      if (!dialled(input, 'intensity', 'showBackground')) return refused('badInput')

      open.skybox.environmentIntensity =
        number(input, 'intensity') ?? open.skybox.environmentIntensity
      open.modified = true
      return done
    }

    case 'skybox.adjust': {
      if (!dialled(input, 'exposure', 'contrast', 'saturation', 'temperature', 'tint')) {
        return dialled(input, 'rotationY', 'blur') ? done : refused('badInput')
      }

      open.skybox.adjusted = true
      return done
    }

    case 'skybox.resetAdjustments':
      open.skybox.adjusted = false
      return done

    case 'texture.state':
      return answered({ material: open.material, channels: open.channels })

    /** The dials of a material document — no name here, the document already has one. */
    case 'texture.material': {
      const colour = text(input, 'color')
      if (colour === '' && !dialled(input, 'roughness', 'metalness', 'tilingX', 'tilingY')) {
        return refused('badInput')
      }

      open.material = colour || 'standard'
      open.modified = true
      return done
    }

    /** ONE channel and its picture — never a record, which is `node.material`'s spelling. */
    case 'texture.channel': {
      const channel = text(input, 'channel')
      if (channel === '') return refused('badInput')

      const assetId = text(input, 'assetId')
      if (assetId === '') delete open.channels[channel]
      else open.channels[channel] = assetId
      open.modified = true
      return done
    }

    case 'texture.preview':
      return dialled(input, 'envIntensity', 'envRotation', 'showBackground', 'autoSpin')
        ? done
        : refused('badInput')

    case 'skybox.view':
      return flag(input, 'probes') || text(input, 'view') !== '' ? done : refused('badInput')

    default:
      return null
  }
}
