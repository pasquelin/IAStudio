import * as T from 'three'
import { createGltfSource } from './gltfSource'
import { disposeTree } from './modelCache'
import { retargetPlanOf, wireBonesOf, skeletonScaleOf } from './retarget'

const preset = {
  size: 512,
  background: '#151921',
  camera: [9, 8, 22],
  margin: 1.27,
  exposure: 1.05,
  samples: 17,
}
const poses: Record<string, number> = {
  Idle: 0.5,
  IdleBreathing: 0.85,
  IdleBriefcase: 0.25,
  IdleHappy: 0.3,
  IdleSad: 0.45,
  IdleShift: 0.3,
  Jump: 0.39,
  RunningJump: 0.39,
  StrafeLeft: 0.25,
  StrafeRight: 0.65,
  TurnAround: 0.55,
  TurnLeft: 0.29,
  TurnRight: 0.5,
  Walk: 0.75,
  WalkStart: 0.45,
  WalkStop: 0.45,
}

export async function createAnimationThumbnailRenderer(model: ArrayBuffer, decoderRoot?: string) {
  const canvas = new OffscreenCanvas(preset.size, preset.size)
  const renderer = new T.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
  })
  renderer.setPixelRatio(1)
  renderer.setSize(preset.size, preset.size, false)
  renderer.toneMapping = T.ACESFilmicToneMapping
  renderer.toneMappingExposure = preset.exposure
  renderer.outputColorSpace = T.SRGBColorSpace
  const scene = new T.Scene()
  scene.background = new T.Color(preset.background)
  scene.add(new T.HemisphereLight(0xffffff, 0x777777, 1.3))
  const key = new T.DirectionalLight(0xffffff, 3)
  key.position.set(3, 12, 8)
  scene.add(key)
  const rim = new T.DirectionalLight(0xffffff, 1.5)
  rim.position.set(-5, 4, -6)
  scene.add(rim)
  const loader = createGltfSource(() => renderer, undefined, decoderRoot)
  if (!loader.parse) throw new Error('The model parser is unavailable')
  const character = await loader.parse(model, '')
  scene.add(character)
  scene.updateMatrixWorld(true)
  const bones: T.Bone[] = []
  character.traverse(o => {
    if (o instanceof T.Bone) bones.push(o)
  })
  const rest = new Map(
    bones.map(b => [
      b.name,
      {
        local: b.quaternion.clone(),
        pos: b.position.clone(),
        world: b.getWorldQuaternion(new T.Quaternion()),
      },
    ]),
  )
  const foundHip = bones.find(b => b.name === 'Hips')
  if (!foundHip) throw new Error('The character must have a Hips bone')
  const hip = foundHip
  const bounds = () => {
    scene.updateMatrixWorld(true)
    const box = new T.Box3()
    const point = new T.Vector3()
    character.traverse(o => {
      if (!(o instanceof T.Mesh)) return
      if (o instanceof T.SkinnedMesh) o.skeleton.update()
      for (let i = 0; i < o.geometry.attributes.position.count; i++) {
        o.getVertexPosition(i, point)
        box.expandByPoint(point.applyMatrix4(o.matrixWorld))
      }
    })
    return box
  }
  const restBounds = bounds(),
    restHeight = restBounds.max.y - restBounds.min.y
  const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.001, restHeight * 100)
  const direction = new T.Vector3().fromArray(preset.camera).normalize()
  const restore = () => {
    for (const b of bones) {
      const saved = rest.get(b.name)
      if (!saved) continue
      b.quaternion.copy(saved.local)
      b.position.copy(saved.pos)
    }
    scene.updateMatrixWorld(true)
  }

  async function render({ animationUrl, name }: { animationUrl: string; name: string }) {
    restore()
    const source = await loader.loadAnimation(animationUrl)
    let mixer: T.AnimationMixer | undefined
    try {
      source.updateMatrixWorld(true)
      const refs = new Map<string, { o: T.Object3D; world: T.Quaternion }>()
      source.traverse(o => {
        if (o.name) refs.set(o.name, { o, world: o.getWorldQuaternion(new T.Quaternion()) })
      })
      const names = retargetPlanOf(wireBonesOf(character), wireBonesOf(source), []).names
      const clip = source.animations[0]
      if (!clip) throw new Error(`No clip in ${name}`)
      const sourceHip = refs.get(names.Hips ?? 'Hips')
      if (!sourceHip) throw new Error(`Hips missing in ${name}`)
      const sh = sourceHip

      const scale = skeletonScaleOf(character, source)
      mixer = new T.AnimationMixer(source)
      const action = mixer.clipAction(clip)
      action.setLoop(T.LoopOnce, 1)
      action.clampWhenFinished = true
      action.play()
      const playing = mixer
      const sample = (f: number) => {
        playing.setTime(Math.min(Math.max(0, f) * clip.duration, clip.duration - 1e-6))
        source.updateMatrixWorld(true)
      }
      const yaw = () => {
        const q = sh.o.getWorldQuaternion(new T.Quaternion()).multiply(sh.world.clone().invert())
        const v = new T.Vector3(0, 0, 1).applyQuaternion(q)
        return Math.atan2(v.x, v.z)
      }
      sample(0)
      const initialYaw = yaw(),
        startY = sh.o.getWorldPosition(new T.Vector3()).y
      const start = new Map(
        [...refs].map(([n, r]) => [n, r.o.getWorldQuaternion(new T.Quaternion())]),
      )
      const relativeYaw = () =>
        Math.atan2(Math.sin(yaw() - initialYaw), Math.cos(yaw() - initialYaw))
      function poseScore(): number {
        let score = 0
        if (/jump/i.test(name)) score = sh.o.getWorldPosition(new T.Vector3()).y
        else if (/^Turn(Left|Right)$/.test(name))
          score = -Math.abs(Math.abs(relativeYaw()) - Math.PI / 4)
        else if (name === 'TurnAround') score = -Math.abs(Math.abs(relativeYaw()) - Math.PI * 0.8)
        else {
          const scoredNames = /sad|happy/i.test(name)
            ? ['Head', 'Chest', 'LeftUpperArm', 'RightUpperArm']
            : /idle/i.test(name)
              ? ['Head', 'Chest', 'Hips', 'LeftUpperLeg', 'RightUpperLeg']
              : ['LeftUpperLeg', 'RightUpperLeg']
          for (const n of scoredNames) {
            // `refs` and `start` are keyed by SOURCE names, `scoredNames` by the character's:
            // read one of them untranslated and a Mixamo clip scores against its bind pose.
            const from = names[n] ?? n
            const r = refs.get(from)
            if (r)
              score += r.o
                .getWorldQuaternion(new T.Quaternion())
                .angleTo(start.get(from) ?? r.world)
          }
        }
        return score
      }
      function choosePose(): number {
        let chosen: number | undefined = poses[name]
        if (chosen === undefined) {
          let best = -Infinity
          for (let i = 1; i < preset.samples; i++) {
            const f = i / preset.samples
            sample(f)
            const score = poseScore()
            if (score > best) {
              best = score
              chosen = f
            }
          }
        }
        if (chosen === undefined || !Number.isFinite(chosen) || chosen < 0 || chosen > 1)
          throw new Error('The pose fraction must be between 0 and 1')
        return chosen
      }
      const chosen = choosePose()
      sample(chosen)
      function applyPose(): void {
        const correction = new T.Quaternion().setFromAxisAngle(
          new T.Vector3(0, 1, 0),
          /^Turn(Left|Right)$/.test(name) ? -initialYaw : 0,
        )
        const desired = new Map<string, T.Quaternion>()
        for (const b of bones) {
          const saved = rest.get(b.name)
          if (!saved) continue
          const r = refs.get(names[b.name] ?? b.name),
            parent =
              (b.parent instanceof T.Bone
                ? desired.get(b.parent.name)
                : b.parent?.getWorldQuaternion(new T.Quaternion())) ?? new T.Quaternion()
          const world = r
            ? correction
                .clone()
                .multiply(r.o.getWorldQuaternion(new T.Quaternion()))
                .multiply(r.world.clone().invert())
                .multiply(saved.world)
            : parent.clone().multiply(saved.local)
          desired.set(b.name, world)
          b.quaternion.copy(parent.clone().invert().multiply(world))
        }
        hip.position.y =
          (rest.get('Hips')?.pos.y ?? 0) +
          (sh.o.getWorldPosition(new T.Vector3()).y - startY) * scale
      }
      applyPose()
      function framePose(): void {
        const box = bounds(),
          center = box.getCenter(new T.Vector3())
        direction
          .fromArray(/^Turn(Left|Right)$/.test(name) ? [0, 7, 24] : preset.camera)
          .normalize()
        camera.position.copy(center).addScaledVector(direction, restHeight * 5)
        camera.lookAt(center)
        camera.updateMatrixWorld(true)
        const span = Math.max(box.max.y - box.min.y, box.max.x - box.min.x) * preset.margin
        camera.left = camera.bottom = -span / 2
        camera.right = camera.top = span / 2
        camera.updateProjectionMatrix()
      }
      framePose()
      renderer.render(scene, camera)
      return {
        png: new Uint8Array(
          await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer(),
        ),
      }
    } finally {
      mixer?.stopAllAction()
      if (mixer) mixer.uncacheRoot(source)
      disposeTree(source)
      restore()
    }
  }
  return {
    render,
    dispose() {
      disposeTree(character)
      loader.dispose()
      renderer.dispose()
    },
    canvas,
  }
}
