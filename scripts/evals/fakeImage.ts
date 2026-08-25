import type { ActionOutcome } from '@shared/domain/assistant'
import { answered, done, front, nextId, refused, type Bench, type StudioDocument } from './bench'
import { byId, flag, number, text, type Input } from './inputs'

/** Everything an image document answers — the layer stack of sections 18 and 19. */

const stateOf = (image: StudioDocument): unknown => ({
  documentId: image.id,
  width: image.width,
  height: image.height,
  layers: image.layers.map(one => ({
    id: one.id,
    name: one.name,
    kind: one.kind,
    opacity: one.opacity,
    visible: one.visible,
    locked: one.locked,
    x: one.x,
    y: one.y,
    scale: one.scale,
    rotation: one.rotation,
  })),
})

export function imageAction(bench: Bench, action: string, input: Input): ActionOutcome | null {
  const image = front(bench)
  if (!image || image.space !== 'image') return null

  switch (action) {
    case 'canvas.state':
      return answered(stateOf(image))

    case 'canvas.resize': {
      const width = number(input, 'width')
      const height = number(input, 'height')
      if (width === null || height === null) return refused('badInput')

      image.width = width
      image.height = height
      image.modified = true
      return done
    }

    case 'layer.add': {
      const layer = {
        id: nextId(bench, 'layer'),
        name: text(input, 'name'),
        kind: text(input, 'kind'),
        opacity: 1,
        visible: true,
        locked: false,
        x: 0,
        y: 0,
        scale: 1,
        rotation: 0,
        assetId: text(input, 'assetId') || null,
        text: null,
      }
      // Index 0 is the BOTTOM, as `addLayer` holds it — a bench stacking the other way round
      // rewarded `index: 1` for « passe-le derrière », which the studio reads as `index: 0`.
      image.layers.push(layer)
      image.modified = true
      return answered({ layerId: layer.id })
    }

    case 'layer.remove': {
      const layer = byId(image.layers, input, 'layerId')
      if (!layer) return refused('badInput')

      image.layers = image.layers.filter(one => one !== layer)
      image.modified = true
      return done
    }

    case 'layer.rename': {
      const layer = byId(image.layers, input, 'layerId')
      const name = text(input, 'name')
      if (!layer || name === '') return refused('badInput')

      layer.name = name
      image.modified = true
      return done
    }

    case 'layer.style': {
      const layer = byId(image.layers, input, 'layerId')
      if (!layer) return refused('badInput')

      const opacity = number(input, 'opacity')
      if (opacity === null && input['visible'] === undefined) return refused('badInput')

      if (opacity !== null) layer.opacity = opacity
      if (input['visible'] !== undefined) layer.visible = flag(input, 'visible')
      image.modified = true
      return done
    }

    case 'layer.transform': {
      const layer = byId(image.layers, input, 'layerId')
      if (!layer) return refused('badInput')

      const x = number(input, 'x')
      const y = number(input, 'y')
      // Two axes and not one: the studio scales X and Y apart, and « sans la déformer » is the
      // whole point of one scenario. What the bench keeps is the X, which the oracles read.
      const scale = number(input, 'scaleX')
      const rotation = number(input, 'rotation')
      if (x === null && y === null && scale === null && rotation === null) {
        return refused('badInput')
      }

      layer.x = x ?? layer.x
      layer.y = y ?? layer.y
      layer.scale = scale ?? layer.scale
      layer.rotation = rotation ?? layer.rotation
      image.modified = true
      return done
    }

    case 'layer.move': {
      const layer = byId(image.layers, input, 'layerId')
      const to = number(input, 'index')
      if (!layer || to === null) return refused('badInput')

      image.layers = image.layers.filter(one => one !== layer)
      image.layers.splice(Math.max(0, Math.min(to, image.layers.length)), 0, layer)
      image.modified = true
      return done
    }

    case 'layer.select':
      bench.selection = { kind: 'layer', ids: [text(input, 'layerId')] }
      return done

    case 'layer.lock': {
      const layer = byId(image.layers, input, 'layerId')
      if (!layer) return refused('badInput')

      layer.locked = flag(input, 'pixels') || flag(input, 'position') || flag(input, 'alpha')
      image.modified = true
      return done
    }

    case 'layer.duplicate': {
      const layer = byId(image.layers, input, 'layerId')
      if (!layer) return refused('badInput')

      const copy = { ...layer, id: nextId(bench, 'layer'), name: `${layer.name} copy` }
      image.layers.push(copy)
      image.modified = true
      return answered({ layerId: copy.id })
    }

    case 'layer.text': {
      const layer = byId(image.layers, input, 'layerId')
      const value = text(input, 'text')
      if (!layer || value === '') return refused('badInput')

      layer.text = value
      image.modified = true
      return done
    }

    default:
      return null
  }
}
