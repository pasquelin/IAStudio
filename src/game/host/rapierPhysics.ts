// SPDX-License-Identifier: MIT

import type * as RapierModule from '@dimforge/rapier3d-compat'
import { quaternionFromEuler } from '../physics/quaternion'
import { HULL_FLOOR, type ColliderShape } from '../physics/shape'
import type {
  BodyDescriptor,
  BodyPose,
  CharacterMoved,
  PhysicsContact,
  PhysicsPort,
} from '../ports/physicsPort'

type Rapier = typeof RapierModule
type RapierWorld = InstanceType<Rapier['World']>
type RapierBody = ReturnType<RapierWorld['createRigidBody']>
type RapierCollider = ReturnType<RapierWorld['createCollider']>
type RapierDesc = InstanceType<Rapier['ColliderDesc']>

/** The gap Rapier keeps between a character and what it touches. Its own documented order. */
const CHARACTER_SKIN = 0.01

/** How much clear floor a step must land on before it is walked over rather than bumped into. */
const AUTOSTEP_LANDING = 0.2

const DEGREES = Math.PI / 180

/** Rewritten in place: a character's next placement is read by the engine and never kept. */
const NEXT = { x: 0, y: 0, z: 0 }

/**
 * 🛑 Held for the life of the window, and it MUST be: `init` instantiates the WebAssembly with a
 * memory of its own, so a second call hands back an engine whose worlds share nothing with the
 * ones already running. Held as the PROMISE, so two games starting at once wait on one load.
 */
let engine: Promise<Rapier> | null = null

/**
 * 🛑 Imported dynamically: `rapier3d-compat` inlines its WebAssembly as base64 and weighs 2,7 Mo,
 * which a static import would put in every window that draws a document. 27,3 ms to initialise.
 */
export async function loadRapierPhysics(): Promise<PhysicsPort> {
  engine ??= startEngine()

  let rapier: Rapier
  // 🛑 The LOAD alone: a world that failed to build must not clear the memo, or the next Play
  // would call `init` a second time and orphan every world already running in this window.
  try {
    rapier = await engine
  } catch (trouble) {
    engine = null
    throw trouble
  }
  return createRapierPhysics(rapier)
}

async function startEngine(): Promise<Rapier> {
  const rapier = await import('@dimforge/rapier3d-compat')
  await rapier.init()
  return rapier
}

type Held = {
  descriptor: BodyDescriptor
  rigid: RapierBody
  colliders: RapierCollider[]
}

/** Takes the module rather than reaching for it, so the load stays in one place above. */
function createRapierPhysics(rapier: Rapier): PhysicsPort {
  const world = new rapier.World({ x: 0, y: 0, z: 0 })
  const events = new rapier.EventQueue(true)
  const controller = world.createCharacterController(CHARACTER_SKIN)
  controller.setUp({ x: 0, y: 1, z: 0 })
  controller.setSlideEnabled(true)

  const held = new Map<string, Held>()
  const namesByCollider = new Map<number, string>()
  const namesByBody = new Map<number, string>()
  const refused: string[] = []
  // Reused between steps, which is what the port's contract reserves the right to do: a body
  // that moves every frame would otherwise allocate two objects a frame for the life of the
  // game. `pool` HOLDS them and never shrinks; `poses` is the list of references handed out.
  const pool: BodyPose[] = []
  const poses: BodyPose[] = []
  const contacts: PhysicsContact[] = []
  const moved: CharacterMoved[] = []
  let controlling: BodyDescriptor['character'] = null

  // Hoisted rather than written at the call: it captures three maps and would be rebuilt sixty
  // times a second.
  const met = (first: number, second: number, started: boolean): void => {
    const one = namesByCollider.get(first)
    const other = namesByCollider.get(second)
    if (one === undefined || other === undefined) return
    const sensed = sensorOf(held, one) || sensorOf(held, other)
    contacts.push({ body: one, other, started, sensed })
    contacts.push({ body: other, other: one, started, sensed })
  }

  const forget = (name: string): void => {
    const body = held.get(name)
    if (!body) return
    for (const collider of body.colliders) namesByCollider.delete(collider.handle)
    namesByBody.delete(body.rigid.handle)
    world.removeRigidBody(body.rigid)
    held.delete(name)
  }

  return {
    setGravity: y => {
      world.gravity = { x: 0, y, z: 0 }
    },

    add: bodies => {
      refused.length = 0
      for (const descriptor of bodies) {
        forget(descriptor.body)
        const shapes = descsOf(rapier, descriptor.shape)
        // Refused rather than added empty: a body with no collider falls through the world in
        // silence, and its name is the only thing that tells an author which object it was.
        if (shapes.length === 0) {
          refused.push(descriptor.body)
          continue
        }

        const rigid = world.createRigidBody(rigidDescOf(rapier, descriptor))
        // 🛑 Divided: Rapier SUMS the masses of a body's colliders, so a carved solid felt as
        // thirty-two pieces weighed thirty-two times what its author asked for.
        const share = descriptor.mass / shapes.length
        const colliders = shapes.map(shape =>
          world.createCollider(dressed(rapier, shape, descriptor, share), rigid),
        )
        for (const collider of colliders) namesByCollider.set(collider.handle, descriptor.body)
        namesByBody.set(rigid.handle, descriptor.body)
        held.set(descriptor.body, { descriptor, rigid, colliders })
      }
      // Copied out: the port reserves the right to reuse `poses` and `contacts`, never this.
      return [...refused]
    },

    remove: bodies => {
      for (const name of bodies) forget(name)
    },

    place: next => {
      for (const pose of next) {
        const body = held.get(pose.body)
        if (!body || body.descriptor.kind !== 'kinematic') continue
        body.rigid.setNextKinematicTranslation(pose.position)
        body.rigid.setNextKinematicRotation(pose.rotation)
      }
    },

    moveCharacters: wanted => {
      moved.length = 0
      for (const one of wanted) {
        const body = held.get(one.body)
        const collider = body?.colliders[0]
        if (!body?.descriptor.character || !collider) continue

        // Only when they CHANGE: the three setters cross into the WebAssembly, and a character's
        // settings are frozen at the moment its body was built.
        if (controlling !== body.descriptor.character) {
          controlling = body.descriptor.character
          dressController(controller, controlling)
        }
        controller.computeColliderMovement(collider, one.wanted)
        const step = controller.computedMovement()
        const at = body.rigid.translation()
        NEXT.x = at.x + step.x
        NEXT.y = at.y + step.y
        NEXT.z = at.z + step.z
        body.rigid.setNextKinematicTranslation(NEXT)
        moved.push({ body: one.body, moved: step, grounded: controller.computedGrounded() })
      }
      return moved
    },

    step: dt => {
      world.timestep = dt
      contacts.length = 0
      world.step(events)
      events.drainCollisionEvents(met)
    },

    // 🛑 The ACTIVE island, never the whole map: a settled scene of five hundred crates would
    // otherwise cross into the WebAssembly five hundred times a frame to be told they all sleep.
    poses: () => {
      poses.length = 0
      world.forEachActiveRigidBody(rigid => {
        const name = namesByBody.get(rigid.handle)
        const body = name === undefined ? undefined : held.get(name)
        // A kinematic body is where the game just put it, and reading it back says nothing.
        if (name === undefined || !body || !movesItself(body)) return

        const pose = pooled(pool, poses.length)
        const at = rigid.translation()
        const turn = rigid.rotation()
        pose.body = name
        pose.position.x = at.x
        pose.position.y = at.y
        pose.position.z = at.z
        pose.rotation.x = turn.x
        pose.rotation.y = turn.y
        pose.rotation.z = turn.z
        pose.rotation.w = turn.w
        poses.push(pose)
      })
      return poses
    },

    contacts: () => contacts,

    dispose: () => {
      held.clear()
      namesByCollider.clear()
      namesByBody.clear()
      events.free()
      world.free()
    },
  }
}

function pooled(pool: BodyPose[], at: number): BodyPose {
  const held = pool[at]
  if (held) return held

  const made: BodyPose = {
    body: '',
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
  }
  pool.push(made)
  return made
}

const movesItself = (body: Held): boolean =>
  body.descriptor.kind === 'dynamic' || body.descriptor.character !== null

const sensorOf = (held: Map<string, Held>, name: string): boolean =>
  held.get(name)?.descriptor.sensor === true

function dressController(
  controller: ReturnType<RapierWorld['createCharacterController']>,
  settings: NonNullable<BodyDescriptor['character']>,
): void {
  controller.enableAutostep(settings.stepHeight, AUTOSTEP_LANDING, true)
  controller.enableSnapToGround(settings.snapDistance)
  controller.setMaxSlopeClimbAngle(settings.slopeLimit * DEGREES)
}

function rigidDescOf(
  rapier: Rapier,
  descriptor: BodyDescriptor,
): InstanceType<Rapier['RigidBodyDesc']> {
  const desc = kinematicOf(rapier, descriptor)
  desc.setTranslation(
    descriptor.transform.position.x,
    descriptor.transform.position.y,
    descriptor.transform.position.z,
  )
  desc.setRotation(quaternionFromEuler(descriptor.transform.rotation))
  desc.setGravityScale(descriptor.gravityScale)
  if (descriptor.lockRotation) desc.lockRotations()
  return desc
}

const kinematicOf = (
  rapier: Rapier,
  descriptor: BodyDescriptor,
): InstanceType<Rapier['RigidBodyDesc']> => {
  if (descriptor.character !== null || descriptor.kind === 'kinematic') {
    return rapier.RigidBodyDesc.kinematicPositionBased()
  }
  return descriptor.kind === 'dynamic'
    ? rapier.RigidBodyDesc.dynamic()
    : rapier.RigidBodyDesc.fixed()
}

function dressed(
  rapier: Rapier,
  shape: RapierDesc,
  descriptor: BodyDescriptor,
  mass: number,
): RapierDesc {
  shape.setFriction(descriptor.friction)
  shape.setRestitution(descriptor.restitution)
  if (mass > 0) shape.setMass(mass)
  if (descriptor.sensor) shape.setSensor(true)

  // Not on everything: two fixed bodies never meet, and asking the engine to watch a pair it
  // would skip is broadphase work for an event nobody can receive.
  if (descriptor.kind !== 'fixed' || descriptor.sensor) {
    shape.setActiveEvents(rapier.ActiveEvents.COLLISION_EVENTS)
    // A kinematic body against a fixed one is OUT of Rapier's default set, which is exactly the
    // pair a trigger on the floor and a walking character make.
    shape.setActiveCollisionTypes(rapier.ActiveCollisionTypes.ALL)
  }
  return shape
}

/**
 * One collider description per convex piece — the shape's own scale is already baked in, since
 * Rapier holds no scale of its own and a document's is not uniform.
 */
function descsOf(rapier: Rapier, shape: ColliderShape): RapierDesc[] {
  if (shape.kind === 'cuboid') {
    const desc = rapier.ColliderDesc.cuboid(shape.hx, shape.hy, shape.hz)
    if (shape.at) desc.setTranslation(shape.at.x, shape.at.y, shape.at.z)
    return [desc]
  }
  if (shape.kind === 'ball') return [rapier.ColliderDesc.ball(shape.radius)]
  if (shape.kind === 'capsule') {
    return [rapier.ColliderDesc.capsule(shape.halfHeight, shape.radius)]
  }
  if (shape.kind === 'cylinder') {
    return [rapier.ColliderDesc.cylinder(shape.halfHeight, shape.radius)]
  }
  if (shape.kind === 'cone') return [rapier.ColliderDesc.cone(shape.halfHeight, shape.radius)]
  if (shape.kind === 'trimesh') {
    return [rapier.ColliderDesc.trimesh(shape.vertices, shape.indices)]
  }

  const clouds = shape.kind === 'hull' ? [shape.points] : shape.parts
  // 🛑 The floor is checked HERE and not left to Rapier: `convexHull` hands back a description
  // for two points, and it is `createCollider` that then throws — from inside the WebAssembly,
  // where nothing says which body it was.
  return clouds
    .filter(points => points.length >= HULL_FLOOR * 3)
    .flatMap(points => rapier.ColliderDesc.convexHull(points) ?? [])
}
