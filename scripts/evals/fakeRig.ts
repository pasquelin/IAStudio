import type { ActionOutcome } from '@shared/domain/assistant'
import { answered, done, front, nextId, refused, type Bench, type SceneNode } from './bench'
import { byId, flag, number, text, vector, type Input } from './inputs'

/**
 * The skeleton, the paths, the 3D text, the view and what animation asks for beyond a key —
 * sections 46, 47, 49 and 50.
 *
 * Written apart from `fakeScene` rather than added to it: this is the half of the 3D surface a
 * person reaches through a model, and the two grow at different rates.
 */

const RIGGABLE = ['model', 'box', 'sphere', 'cylinder']

export function rigAction(bench: Bench, action: string, input: Input): ActionOutcome | null {
  const scene = front(bench)
  if (!scene || scene.space !== '3d') return null

  const rig = scene.rig
  const aimed = (): SceneNode | undefined => byId(scene.nodes, input, 'nodeId')

  switch (action) {
    case 'node.text': {
      const node = aimed()
      if (node?.kind !== 'text') return refused('badInput')

      const value = text(input, 'value')
      if (value !== '') node.text = value
      scene.modified = true
      return done
    }

    case 'node.path': {
      const node = aimed()
      if (node?.kind !== 'path') return refused('badInput')

      node.closed = flag(input, 'closed')
      scene.modified = true
      return done
    }

    case 'path.addPoint': {
      const node = aimed()
      if (node?.kind !== 'path') return refused('badInput')

      node.points.push(vector(input, 'point'))
      scene.modified = true
      return done
    }

    case 'path.movePoint': {
      const node = aimed()
      const at = number(input, 'index')
      const point = at === null ? undefined : node?.points[at]
      if (!node || !point) return refused('badInput')

      node.points[at ?? 0] = vector(input, 'point', point)
      scene.modified = true
      return done
    }

    case 'path.removePoint': {
      const node = aimed()
      const at = number(input, 'index')
      if (!node || at === null || at < 0 || at >= node.points.length) return refused('badInput')

      node.points.splice(at, 1)
      scene.modified = true
      return done
    }

    // Order is read off the node list: bringing a camera first moves it there.
    case 'camera.reorder': {
      const node = aimed()
      if (node?.kind !== 'camera') return refused('badInput')

      scene.nodes = [node, ...scene.nodes.filter(one => one !== node)]
      scene.modified = true
      return done
    }

    case 'view.direction':
      return text(input, 'direction') === '' ? refused('badInput') : done

    case 'scene.capture': {
      scene.captures += 1
      bench.assets.push({
        id: nextId(bench, 'asset'),
        name: `Capture de ${scene.title}`,
        type: 'image',
        path: null,
        jobId: null,
        tags: [],
      })
      return done
    }

    case 'animation.block': {
      const clip = scene.animations.find(one => one.id === text(input, 'clipId'))
      if (!clip) return refused('notFound')

      const from = number(input, 'startSeconds') ?? 0
      const span = number(input, 'fadeSeconds')
      clip.keys = clip.keys.filter(
        one => one.at >= from && (span === null || one.at <= from + span),
      )
      scene.modified = true
      return done
    }

    case 'animation.autoKey':
      if (input['on'] === undefined) return refused('badInput')

      scene.autoKey = flag(input, 'on')
      return done

    // Every key of every channel, or every key at one moment — the second is what `timeSeconds`
    // narrows it to.
    case 'key.all': {
      const at = number(input, 'timeSeconds')
      for (const clip of scene.animations) {
        clip.keys = at === null ? [] : clip.keys.filter(one => one.at !== at)
      }
      scene.modified = true
      return done
    }

    case 'key.move': {
      const from = number(input, 'fromSeconds')
      const to = number(input, 'toSeconds')
      if (from === null || to === null) return refused('badInput')

      for (const clip of scene.animations) {
        for (const key of clip.keys) if (key.at === from) key.at = to
      }
      scene.modified = true
      return done
    }

    case 'channel.flags': {
      if (input['muted'] === undefined && input['solo'] === undefined) return refused('badInput')

      scene.modified = true
      return done
    }

    case 'rig.state':
      return answered({ fitted: rig.fitted, hands: rig.hands, bones: rig.bones, chains: rig.iks })

    case 'rig.fit': {
      const node = aimed()
      if (!node || !RIGGABLE.includes(node.kind)) return refused('badInput')

      rig.fitted = true
      rig.bones = [
        { name: 'Hips', role: 'hips' },
        { name: 'Bras Droit', role: 'rightUpperArm' },
        { name: 'Jambe Gauche', role: 'leftUpperLeg' },
      ]
      scene.modified = true
      return done
    }

    case 'rig.hands':
      if (!rig.fitted) return refused('badInput')

      rig.hands = true
      scene.modified = true
      return done

    case 'rig.clear':
      rig.fitted = false
      rig.hands = false
      rig.bones = []
      rig.iks = []
      scene.modified = true
      return done

    // 🛑 `parent` and not `bone`: the registry names the bone the new one hangs FROM, and the
    // new one is named by the studio. A bench reading `bone` refused every well-formed call.
    case 'bone.add': {
      const parent = text(input, 'parent')
      if (!rig.fitted || parent === '') return refused('badInput')

      rig.bones.push({ name: `Os ${rig.bones.length + 1}`, role: null })
      scene.modified = true
      return done
    }

    case 'bone.remove': {
      const name = text(input, 'bone')
      if (!rig.bones.some(one => one.name === name)) return refused('notFound')

      rig.bones = rig.bones.filter(one => one.name !== name)
      scene.modified = true
      return done
    }

    case 'bone.rename': {
      const bone = rig.bones.find(one => one.name === text(input, 'bone'))
      const name = text(input, 'name')
      if (!bone || name === '') return refused('badInput')

      bone.name = name
      scene.modified = true
      return done
    }

    case 'bone.role': {
      const bone = rig.bones.find(one => one.name === text(input, 'bone'))
      const role = text(input, 'role')
      if (!bone || role === '') return refused('badInput')

      bone.role = role
      scene.modified = true
      return done
    }

    case 'ik.add': {
      const bone = text(input, 'bone')
      if (!rig.fitted || bone === '') return refused('badInput')

      rig.iks.push(bone)
      scene.modified = true
      return done
    }

    case 'ik.remove': {
      if (rig.iks.length === 0) return refused('notFound')

      rig.iks.pop()
      scene.modified = true
      return done
    }

    default:
      return null
  }
}
