import type { ActionOutcome } from '@shared/domain/assistant'
import { MESH_ENTRIES } from '@shared/domain/scene'
import {
  answered,
  done,
  front,
  nextId,
  ORIGIN,
  refused,
  UNIT,
  type Animation,
  type Bench,
  type SceneNode,
  type StudioDocument,
} from './bench'
import { byId, flag, named, number, slots, text, texts, vector, type Input } from './inputs'

/** Everything a 3D document answers — the space the batterie spends nine of its sections in. */

const LIGHTS = ['ambient', 'directional', 'hemisphere', 'point', 'spot']

const isMesh = (kind: string): boolean => MESH_ENTRIES.some(entry => entry.kind === kind)

/** What `node.material` reaches: a mesh or a text — and a text's outline takes no tiling. */
const wearsMaterial = (input: Input, kind: string): boolean =>
  isMesh(kind) || (kind === 'text' && input['tilesPerMetre'] === undefined)

function add(bench: Bench, scene: StudioDocument, kind: string, input: Input): ActionOutcome {
  const node: SceneNode = {
    id: nextId(bench, 'node'),
    name: text(input, 'name') || kind || 'Node',
    kind,
    parentId: null,
    position: vector(input, 'position'),
    rotation: { ...ORIGIN },
    scale: { ...UNIT },
    visible: true,
    textures: {},
    roughness: null,
    metalness: null,
    sprite: null,
    color: null,
    intensity: LIGHTS.includes(kind) ? 1 : null,
    targetId: null,
    castShadow: false,
    points: [],
    text: null,
  }
  scene.nodes.push(node)
  scene.modified = true
  return answered({ nodeId: node.id })
}

/** The rows `scene.state` hands back — what "read the current value first" is answered from. */
const stateOf = (scene: StudioDocument): unknown => ({
  documentId: scene.id,
  duration: scene.duration,
  world: scene.world,
  nodes: scene.nodes.map(one => ({
    id: one.id,
    name: one.name,
    kind: one.kind,
    parentId: one.parentId,
    position: one.position,
    rotation: one.rotation,
    scale: one.scale,
    visible: one.visible,
    intensity: one.intensity,
    targetId: one.targetId,
    textures: one.textures,
    roughness: one.roughness,
    metalness: one.metalness,
  })),
  animations: scene.animations.map(one => ({ id: one.id, name: one.name, keys: one.keys.length })),
})

export function sceneAction(bench: Bench, action: string, input: Input): ActionOutcome | null {
  const scene = front(bench)
  if (!scene || scene.space !== '3d') return null

  switch (action) {
    case 'scene.state':
      return answered(stateOf(scene))

    case 'node.add':
      return add(bench, scene, text(input, 'kind'), input)

    case 'node.addModel':
      return text(input, 'assetId') === '' ? refused('badInput') : add(bench, scene, 'model', input)

    case 'node.remove': {
      const node = byId(scene.nodes, input, 'nodeId')
      if (!node) return refused('badInput')

      scene.nodes = scene.nodes.filter(one => one !== node)
      scene.modified = true
      return done
    }

    case 'node.rename': {
      const node = byId(scene.nodes, input, 'nodeId')
      const name = text(input, 'name')
      if (!node || name === '') return refused('badInput')

      node.name = name
      scene.modified = true
      return done
    }

    case 'node.transform': {
      const node = byId(scene.nodes, input, 'nodeId')
      if (!node) return refused('badInput')
      if (!named(input, 'position') && !named(input, 'rotation') && !named(input, 'scale')) {
        return refused('badInput')
      }

      node.position = vector(input, 'position', node.position)
      node.rotation = vector(input, 'rotation', node.rotation)
      node.scale = vector(input, 'scale', node.scale)
      scene.modified = true
      return done
    }

    case 'node.visible': {
      const node = byId(scene.nodes, input, 'nodeId')
      if (!node) return refused('badInput')

      node.visible = flag(input, 'visible')
      scene.modified = true
      return done
    }

    case 'node.material': {
      const node = byId(scene.nodes, input, 'nodeId')
      // An imported model wears `model.textures`, never this one.
      if (!node || !wearsMaterial(input, node.kind)) return refused('badInput')

      const asked = slots(input)
      if (asked === null) return refused('badInput')

      const colour = text(input, 'color')
      const roughness = number(input, 'roughness')
      const metalness = number(input, 'metalness')
      const dialled =
        Object.keys(asked).length > 0 ||
        colour !== '' ||
        roughness !== null ||
        metalness !== null ||
        number(input, 'tilesPerMetre') !== null
      if (!dialled) return refused('badInput')

      node.textures = { ...node.textures, ...asked }
      if (colour !== '') node.color = colour
      if (roughness !== null) node.roughness = roughness
      if (metalness !== null) node.metalness = metalness
      scene.modified = true
      return done
    }

    case 'model.textures': {
      const node = byId(scene.nodes, input, 'nodeId')
      const asked = slots(input)
      if (!node || asked === null || Object.keys(asked).length === 0) return refused('badInput')

      node.textures = { ...node.textures, ...asked }
      scene.modified = true
      return done
    }

    case 'node.geometry': {
      const node = byId(scene.nodes, input, 'nodeId')
      // Aims at a mesh rather than making one: a bench that added a box here scored "resize the
      // cube" as a second cube.
      return node && isMesh(node.kind) ? done : refused('badInput')
    }

    case 'node.sprite': {
      const node = byId(scene.nodes, input, 'nodeId')
      if (node?.kind !== 'sprite') return refused('badInput')

      const map = text(input, 'map')
      if (map !== '') node.sprite = map
      return done
    }

    case 'node.shadow': {
      const node = byId(scene.nodes, input, 'nodeId')
      if (!node) return refused('badInput')

      node.castShadow = flag(input, 'castShadow')
      scene.modified = true
      return done
    }

    case 'node.light': {
      const node = byId(scene.nodes, input, 'nodeId')
      if (!node || node.intensity === null) return refused('badInput')

      const intensity = number(input, 'intensity')
      const colour = text(input, 'color')
      if (intensity === null && colour === '') return refused('badInput')

      if (intensity !== null) node.intensity = intensity
      if (colour !== '') node.color = colour
      scene.modified = true
      return done
    }

    case 'node.camera': {
      const node = byId(scene.nodes, input, 'nodeId')
      return node?.kind === 'camera' ? done : refused('badInput')
    }

    // A shot is what a camera animation IS, and `camera.target` aims at the SHOT rather than at
    // the camera — a bench taking `nodeId` here scored a call the studio refuses.
    case 'camera.shot': {
      const node = byId(scene.nodes, input, 'nodeId')
      if (node?.kind !== 'camera') return refused('badInput')

      const shot: Animation = { id: nextId(bench, 'shot'), name: node.id, keys: [] }
      scene.animations.push(shot)
      const at = number(input, 'startSeconds')
      const span = number(input, 'durationSeconds')
      if (at !== null) shot.keys.push({ channel: `${node.id}.position`, at, value: node.position })
      if (span !== null) {
        shot.keys.push({
          channel: `${node.id}.position`,
          at: (at ?? 0) + span,
          value: node.position,
        })
      }
      scene.modified = true
      return answered({ shotId: shot.id })
    }

    case 'camera.target': {
      const shot = byId(scene.animations, input, 'shotId')
      const at = text(input, 'targetId')
      if (!shot) return refused('badInput')

      const camera = scene.nodes.find(one => one.id === shot.name)
      if (camera && at !== '' && scene.nodes.some(one => one.id === at)) camera.targetId = at
      scene.modified = true
      return done
    }

    case 'node.select': {
      const wanted = texts(input, 'nodeIds')
      bench.selection = {
        kind: 'node',
        ids: wanted.filter(id => scene.nodes.some(one => one.id === id)),
      }
      return done
    }

    case 'node.reparent': {
      const node = byId(scene.nodes, input, 'nodeId')
      if (!node) return refused('badInput')

      node.parentId = text(input, 'parentId') || null
      scene.modified = true
      return done
    }

    case 'view.display':
      return text(input, 'mode') === '' ? refused('badInput') : done

    case 'world.environment': {
      const source = text(input, 'assetId')
      const intensity = number(input, 'intensity')
      const kind = text(input, 'kind')
      if (source === '' && intensity === null && kind === '') return refused('badInput')

      if (source !== '') scene.world.environment = source
      else if (kind !== '') scene.world.environment = kind
      if (intensity !== null) scene.world.environmentIntensity = intensity
      scene.modified = true
      return done
    }

    case 'world.background': {
      const kind = text(input, 'kind')
      if (kind === '') return refused('badInput')

      scene.world.background = kind === 'color' ? text(input, 'color') || 'color' : kind
      scene.modified = true
      return done
    }

    case 'world.render':
      scene.modified = true
      return done

    case 'world.preset':
      scene.world.environment = scene.world.environment ?? text(input, 'preset')
      scene.modified = true
      return done

    case 'world.fog':
      scene.world.fog = text(input, 'kind') !== 'none'
      scene.modified = true
      return done

    case 'world.ground':
      scene.world.ground = flag(input, 'visible')
      scene.world.shadows = flag(input, 'receiveShadow') || scene.world.shadows
      scene.modified = true
      return done

    case 'animation.settings': {
      const duration = number(input, 'durationSeconds')
      if (duration === null && number(input, 'fps') === null) return refused('badInput')

      if (duration !== null) scene.duration = duration
      scene.modified = true
      return done
    }

    case 'animations.list':
      return answered(scene.animations.map(one => ({ id: one.id, name: one.name })))

    case 'animation.add': {
      const node = byId(scene.nodes, input, 'nodeId')
      if (!node) return refused('badInput')

      const clip: Animation = {
        id: nextId(bench, 'anim'),
        name: text(input, 'clipName') || 'Animation',
        keys: [],
      }
      scene.animations.push(clip)
      scene.modified = true
      return answered({ clipId: clip.id })
    }

    case 'animation.remove': {
      const id = text(input, 'clipId')
      scene.animations = scene.animations.filter(one => one.id !== id)
      scene.modified = true
      return done
    }

    /**
     * 🛑 A key takes the pose the node WEARS — the studio gives no way to write a value here, so
     * animating is « transform, then key ». A bench reading a value would let a plan skip the
     * transform and score an animation of nothing.
     */
    case 'key.pose': {
      const node = byId(scene.nodes, input, 'nodeId')
      if (!node) return refused('badInput')

      const property = text(input, 'property') || 'position'
      const worn =
        property === 'rotation' ? node.rotation : property === 'scale' ? node.scale : node.position
      const held = scene.animations[0] ?? {
        id: nextId(bench, 'anim'),
        name: 'Animation',
        keys: [],
      }
      if (!scene.animations.includes(held)) scene.animations.push(held)

      held.keys.push({
        channel: `${node.id}.${property}`,
        at: number(input, 'timeSeconds') ?? 0,
        value: { ...worn },
      })
      scene.modified = true
      return done
    }

    case 'key.clear': {
      const node = byId(scene.nodes, input, 'nodeId')
      const at = number(input, 'timeSeconds')
      if (!node) return refused('badInput')

      // The dot matters: `node-1` prefix-matches `node-10`, and clearing one wiped the other.
      for (const held of scene.animations) {
        held.keys = held.keys.filter(
          one => !one.channel.startsWith(`${node.id}.`) || (at !== null && one.at !== at),
        )
      }
      return done
    }

    // `trackId` and not `channelId`, and a blank one is a refusal: read wrong, this wiped every
    // key of every animation whatever the row named.
    case 'channel.remove': {
      const wanted = text(input, 'trackId')
      if (wanted === '') return refused('badInput')

      for (const held of scene.animations) {
        held.keys = held.keys.filter(one => one.channel !== wanted)
      }
      scene.modified = true
      return done
    }

    case 'camera.addRail':
    case 'camera.rail':
      scene.modified = true
      return scene.animations.some(one => one.id === text(input, 'shotId'))
        ? done
        : refused('badInput')

    default:
      return null
  }
}
