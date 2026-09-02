// SPDX-License-Identifier: MIT

import type { Vector3 } from '@shared/domain/transform'
import { DEGREES } from '../numeric'
import { quaternionFromEuler } from '../physics/quaternion'
import { HULL_FLOOR, type ColliderShape } from '../physics/shape'
import type {
  BodyDescriptor,
  BodyMotion,
  BodyPose,
  CharacterMoved,
  PhysicsContact,
  PhysicsPort,
  VehicleSettings,
  VehicleWheel,
} from '../ports/physicsPort'
import type startJolt from 'jolt-physics/wasm-compat'
import { MOVING, NON_MOVING, layerJoltSettings } from './joltLayers'
import { loadOnce } from './loadOnce'

type JoltModule = Awaited<ReturnType<typeof startJolt>>
type JoltBodyId = InstanceType<JoltModule['BodyID']>
type JoltShape = InstanceType<JoltModule['Shape']>
type JoltShapeSettings = InstanceType<JoltModule['ShapeSettings']>
type JoltCharacter = InstanceType<JoltModule['CharacterVirtual']>
type JoltUpdate = InstanceType<JoltModule['ExtendedUpdateSettings']>
type JoltVector = InstanceType<JoltModule['Vec3']>
type JoltQuat = InstanceType<JoltModule['Quat']>
type JoltPlace = InstanceType<JoltModule['RVec3']>
type JoltBody = InstanceType<JoltModule['Body']>
type JoltVehicle = InstanceType<JoltModule['VehicleConstraint']>

/**
 * 🛑 Jolt sizes its body manager once, where Rapier grew on demand. Eight times the largest bench
 * scene, and a scene past it is refused by name rather than half-built in silence.
 */
const MAX_BODIES = 16384
const MAX_BODY_PAIRS = 16384
const MAX_CONTACT_CONSTRAINTS = 8192

/** One is what a fixed sixty-hertz step wants; more subdivides a step Jolt is already given. */
const COLLISION_STEPS = 1

/** Jolt's own default, and the gap it keeps between a character and what it touches. */
const CHARACTER_SKIN = 0.02

/** Past it a vehicle is let go of by its constraint, so a roll finishes as a roll. */
const MAX_PITCH_ROLL = 60

/** Where a wheel rests between its two ends of travel, as a share of the length asked for. */
const SUSPENSION_SLACK = 0.6

/** Newton-metres a hand brake holds a wheel with — Jolt's own default, given to rear wheels only. */
const HAND_BRAKE_TORQUE = 4000

/** The rounding a wheel's cast keeps at its rim, as a share of its width. */
const WHEEL_CAST_ROUNDING = 0.05

/**
 * The rate a character's wanted displacement is turned into a velocity and back. Any value holds:
 * the same one divides and multiplies, and gravity is the CALLER's — the update runs with none.
 */
const CHARACTER_STEP = 1 / 60

/** A rounded corner cannot be wider than the half extent it rounds. */
const CONVEX_RADIUS = 0.05

const engine = loadOnce(startEngine)

/**
 * 🛑 Imported dynamically: `jolt-physics/wasm-compat` inlines its WebAssembly as base64 and weighs
 * 3,1 Mo, which a static import would put in every window that draws a document.
 */
export async function loadJoltPhysics(): Promise<PhysicsPort> {
  return createJoltPhysics(await engine())
}

async function startEngine(): Promise<JoltModule> {
  const module = await import('jolt-physics/wasm-compat')
  return module.default()
}

/**
 * Bytes left in the engine's heap — the whole memory measure this port has. 🛑 It grows by OUR
 * build alone: the npm one is fixed at 128 Mo and aborts past it.
 */
export async function joltFreeBytes(): Promise<number> {
  return (await engine()).JoltInterface.prototype.sGetFreeMemory()
}

/** Rewritten in place: nothing in Jolt's heap is collected, so a body that moves would leak. */
type Scratch = {
  place: JoltPlace
  turn: JoltQuat
  vector: JoltVector
  zero: JoltVector
  identity: JoltQuat
  up: JoltVector
  weight: InstanceType<JoltModule['MassProperties']>
  /** A wheel model's axle and its top, as three.js draws a cylinder — see `poses`. */
  axle: JoltVector
  rim: JoltVector
}

type Walker = { character: JoltCharacter; update: JoltUpdate }

/** What suspends and drives a `Vehicle`. Reference counted where Jolt counts, and torn down in order. */
type Ride = {
  constraint: JoltVehicle
  listener: InstanceType<JoltModule['VehicleConstraintStepListener']>
  tester: InstanceType<JoltModule['VehicleCollisionTesterCastCylinder']>
  controller: InstanceType<JoltModule['WheeledVehicleController']>
  wheels: readonly VehicleWheel[]
}

type Held = {
  descriptor: BodyDescriptor
  id: JoltBodyId
  /** What walks a `CharacterController`, and where its pose is read from. */
  walker: Walker | null
  ride: Ride | null
}

/** Where a kinematic body was last told to go, kept so a step that hears nothing holds it there. */
type Target = { position: BodyPose['position']; rotation: BodyPose['rotation'] }

/** Takes the module rather than reaching for it, so the load stays in one place above. */
function createJoltPhysics(jolt: JoltModule): PhysicsPort {
  const settings = new jolt.JoltSettings()
  settings.mMaxBodies = MAX_BODIES
  settings.mMaxBodyPairs = MAX_BODY_PAIRS
  settings.mMaxContactConstraints = MAX_CONTACT_CONSTRAINTS
  settings.mMaxWorkerThreads = 0
  layerJoltSettings(jolt, settings)

  const world = new jolt.JoltInterface(settings)
  jolt.destroy(settings)
  const system = world.GetPhysicsSystem()
  const bodies = system.GetBodyInterface()
  const allocator = world.GetTempAllocator()

  const scratch: Scratch = {
    place: new jolt.RVec3(0, 0, 0),
    turn: new jolt.Quat(0, 0, 0, 1),
    vector: new jolt.Vec3(0, 0, 0),
    zero: new jolt.Vec3(0, 0, 0),
    identity: new jolt.Quat(0, 0, 0, 1),
    up: new jolt.Vec3(0, 1, 0),
    weight: new jolt.MassProperties(),
    axle: new jolt.Vec3(0, 1, 0),
    rim: new jolt.Vec3(1, 0, 0),
  }
  const active = new jolt.BodyIDVector()
  const broadFilter = new jolt.DefaultBroadPhaseLayerFilter(
    world.GetObjectVsBroadPhaseLayerFilter(),
    MOVING,
  )
  const layerFilter = new jolt.DefaultObjectLayerFilter(world.GetObjectLayerPairFilter(), MOVING)
  const bodyFilter = new jolt.BodyFilter()
  const shapeFilter = new jolt.ShapeFilter()

  const held = new Map<string, Held>()
  const namesById = new Map<number, string>()
  const walking: Held[] = []
  const riding: Held[] = []
  const targets = new Map<string, Target>()
  const refused: string[] = []
  // `pool` HOLDS the poses and never shrinks; `poses` is the list of references handed out.
  const pool: BodyPose[] = []
  const poses: BodyPose[] = []
  const contacts: PhysicsContact[] = []
  const contactPool: PhysicsContact[] = []
  const moved: CharacterMoved[] = []
  const motions: BodyMotion[] = []
  const motionPool: BodyMotion[] = []

  // Hoisted rather than written at the call: it captures two maps and would be rebuilt sixty
  // times a second.
  const met = (first: number, second: number, started: boolean): void => {
    const one = namesById.get(first)
    const other = namesById.get(second)
    if (one === undefined || other === undefined) return
    const sensed = sensorOf(held, one) || sensorOf(held, other)
    writeContact(pooled(contactPool, contacts.length, freshContact), one, other, started, sensed)
    contacts.push(contactPool[contacts.length]!)
    writeContact(pooled(contactPool, contacts.length, freshContact), other, one, started, sensed)
    contacts.push(contactPool[contacts.length]!)
  }

  const listener = new jolt.ContactListenerJS()
  listener.OnContactValidate = () => jolt.ValidateResult_AcceptAllContactsForThisBodyPair
  listener.OnContactAdded = (first, second) => met(idOf(jolt, first), idOf(jolt, second), true)
  listener.OnContactPersisted = () => {}
  // 🛑 A pair, not two bodies: one of them may already have been destroyed, and `met` answers
  // nothing for a name the map no longer holds.
  listener.OnContactRemoved = pair => {
    const parted = jolt.wrapPointer(pair, jolt.SubShapeIDPair)
    const first = parted.GetBody1ID().GetIndexAndSequenceNumber()
    met(first, parted.GetBody2ID().GetIndexAndSequenceNumber(), false)
  }
  system.SetContactListener(listener)

  const forget = (name: string): void => {
    const body = held.get(name)
    if (!body) return

    namesById.delete(body.id.GetIndexAndSequenceNumber())
    if (body.ride) {
      // The system's references go first, then ours: the constraint is deleted by the LAST
      // release, and a `destroy` on top of that would free it twice.
      system.RemoveStepListener(body.ride.listener)
      system.RemoveConstraint(body.ride.constraint)
      jolt.destroy(body.ride.listener)
      body.ride.constraint.Release()
      body.ride.tester.Release()
      const at = riding.indexOf(body)
      if (at >= 0) riding.splice(at, 1)
    }
    if (body.walker) {
      // The inner body goes with the character that owns it — removing it here would leave the
      // character sweeping a shape the body manager had already reclaimed.
      jolt.destroy(body.walker.update)
      jolt.destroy(body.walker.character)
      const at = walking.indexOf(body)
      if (at >= 0) walking.splice(at, 1)
    } else {
      bodies.RemoveBody(body.id)
      bodies.DestroyBody(body.id)
    }
    jolt.destroy(body.id)
    targets.delete(name)
    held.delete(name)
  }

  const build = (descriptor: BodyDescriptor): boolean => {
    // 🛑 Refused BEFORE the shape is built: Jolt will not move a mesh, where Rapier would. Named
    // rather than quietly swapped for its hull — a body felt as something other than what it
    // draws is the worse lie of the two.
    if (
      descriptor.shape.kind === 'trimesh' &&
      motionOf(jolt, descriptor) !== jolt.EMotionType_Static
    ) {
      return false
    }

    // A vehicle is a DYNAMIC body or nothing: a suspension hung from a fixed one holds nothing up.
    if (descriptor.vehicle && (descriptor.kind !== 'dynamic' || descriptor.character)) return false

    const shape = builtShape(jolt, descriptor.shape, scratch)
    if (!shape) return false

    quaternionFromEuler(descriptor.transform.rotation, SPUN)
    const at = descriptor.transform.position
    scratch.place.Set(at.x, at.y, at.z)
    scratch.turn.Set(SPUN.x, SPUN.y, SPUN.z, SPUN.w)

    const walker = descriptor.character
      ? walkerOf(jolt, system, shape, descriptor.character, scratch)
      : null
    const added = walker ? null : addedBody(jolt, bodies, descriptor, shape, scratch)
    const id = added
      ? added.id
      : new jolt.BodyID(walker!.character.GetInnerBodyID().GetIndexAndSequenceNumber())
    // The body and the character each took their own reference; ours has done its work.
    shape.Release()

    const ride =
      added && descriptor.vehicle
        ? rideOf(jolt, system, added.body, descriptor.vehicle, scratch)
        : null
    const entry: Held = { descriptor, id, walker, ride }
    held.set(descriptor.body, entry)
    namesById.set(id.GetIndexAndSequenceNumber(), descriptor.body)
    if (walker) walking.push(entry)
    if (ride) riding.push(entry)
    return true
  }

  return {
    setGravity: y => {
      scratch.vector.Set(0, y, 0)
      system.SetGravity(scratch.vector)
    },

    add: descriptors => {
      const laying = held.size === 0 && descriptors.length > 0
      refused.length = 0
      for (const descriptor of descriptors) {
        forget(descriptor.body)
        // Refused rather than added empty: a body with no shape falls through the world in
        // silence, and its name is the only thing that says which object it was.
        if (!build(descriptor)) refused.push(descriptor.body)
      }
      // 🛑 The LAY-DOWN alone: Jolt builds its tree incrementally, so a scene added in one call
      // leaves it unbalanced for the whole game. Run on every batch, a game spawning one
      // projectile a step would rebuild the whole tree sixty times a second.
      if (laying) system.OptimizeBroadPhase()
      // Copied out: the port reserves the right to reuse `poses` and `contacts`, never this.
      return [...refused]
    },

    remove: names => {
      for (const name of names) forget(name)
    },

    // 🛑 Held rather than applied: `MoveKinematic` wants the step, which this call is not given,
    // and the last one would be a guess. Held ALSO covers the frame that says nothing — a Jolt
    // kinematic keeps the velocity it was last handed, and would slide away for ever.
    place: next => {
      for (const pose of next) {
        const body = held.get(pose.body)
        if (!body || body.descriptor.kind !== 'kinematic' || body.walker) continue
        const target = targets.get(pose.body) ?? {
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
        }
        target.position.x = pose.position.x
        target.position.y = pose.position.y
        target.position.z = pose.position.z
        target.rotation.x = pose.rotation.x
        target.rotation.y = pose.rotation.y
        target.rotation.z = pose.rotation.z
        target.rotation.w = pose.rotation.w
        targets.set(pose.body, target)
      }
    },

    moveCharacters: wanted => {
      moved.length = 0
      for (const one of wanted) {
        const walker = held.get(one.body)?.walker
        if (!walker) continue

        const before = walker.character.GetPosition()
        const fromX = before.GetX()
        const fromY = before.GetY()
        const fromZ = before.GetZ()
        scratch.vector.Set(
          one.wanted.x / CHARACTER_STEP,
          one.wanted.y / CHARACTER_STEP,
          one.wanted.z / CHARACTER_STEP,
        )
        walker.character.SetLinearVelocity(scratch.vector)
        walker.character.ExtendedUpdate(
          CHARACTER_STEP,
          scratch.zero,
          walker.update,
          broadFilter,
          layerFilter,
          bodyFilter,
          shapeFilter,
          allocator,
        )

        const after = walker.character.GetPosition()
        moved.push({
          body: one.body,
          moved: { x: after.GetX() - fromX, y: after.GetY() - fromY, z: after.GetZ() - fromZ },
          grounded: walker.character.GetGroundState() === jolt.EGroundState_OnGround,
        })
      }
      return moved
    },

    drive: wanted => {
      for (const one of wanted) {
        const body = held.get(one.body)
        if (!body?.ride) continue
        body.ride.controller.SetDriverInput(one.forward, one.steer, one.brake, one.handBrake)
        // A car left alone goes to sleep, and a sleeping one hears no pedal.
        if (one.forward !== 0 || one.steer !== 0 || one.brake !== 0 || one.handBrake !== 0) {
          bodies.ActivateBody(body.id)
        }
      }
    },

    push: forces => {
      for (const one of forces) {
        const body = held.get(one.body)
        if (!body || body.descriptor.kind !== 'dynamic' || body.walker) continue
        scratch.vector.Set(one.force.x, one.force.y, one.force.z)
        bodies.AddForce(body.id, scratch.vector, jolt.EActivation_Activate)
        scratch.vector.Set(one.torque.x, one.torque.y, one.torque.z)
        bodies.AddTorque(body.id, scratch.vector, jolt.EActivation_Activate)
      }
    },

    motion: names => {
      motions.length = 0
      for (const name of names) {
        const body = held.get(name)
        if (!body) continue
        const one = pooled(motionPool, motions.length, freshMotion)
        one.body = name
        writeVector(one.linear, bodies.GetLinearVelocity(body.id))
        writeVector(one.angular, bodies.GetAngularVelocity(body.id))
        motions.push(one)
      }
      return motions
    },

    step: dt => {
      contacts.length = 0
      for (const [name, target] of targets) {
        const body = held.get(name)
        if (!body) continue
        scratch.place.Set(target.position.x, target.position.y, target.position.z)
        scratch.turn.Set(target.rotation.x, target.rotation.y, target.rotation.z, target.rotation.w)
        bodies.MoveKinematic(body.id, scratch.place, scratch.turn, dt)
      }
      world.Step(dt, COLLISION_STEPS)
    },

    // 🛑 The ACTIVE island, never the whole map: a settled scene of five thousand crates would
    // otherwise cross into the WebAssembly five thousand times a frame to be told they all sleep.
    poses: () => {
      poses.length = 0
      system.GetActiveBodies(jolt.EBodyType_RigidBody, active)
      const count = active.size()
      for (let index = 0; index < count; index++) {
        const id = active.at(index)
        const name = namesById.get(id.GetIndexAndSequenceNumber())
        // A kinematic body is where the game just put it, and reading it back says nothing.
        if (name === undefined || held.get(name)?.descriptor.kind !== 'dynamic') continue

        bodies.GetPositionAndRotation(id, scratch.place, scratch.turn)
        const pose = pooled(pool, poses.length, freshPose)
        writePose(pose, name, scratch.place, scratch.turn)
        poses.push(pose)
      }

      // Read from the character rather than from its inner body: a standing one is allowed to
      // leave the active island, and the camera that watches it would then never hear again.
      for (const entry of walking) {
        if (!entry.walker) continue
        const pose = pooled(pool, poses.length, freshPose)
        const walker = entry.walker.character
        writePose(pose, entry.descriptor.body, walker.GetPosition(), walker.GetRotation())
        poses.push(pose)
      }

      // Every wheel, every step, asleep or not: four a vehicle, and a wheel that stopped being
      // reported would be drawn where the last step left it.
      for (const entry of riding) {
        if (!entry.ride) continue
        for (let index = 0; index < entry.ride.wheels.length; index++) {
          const wheel = entry.ride.wheels[index]
          if (!wheel) continue
          const placed = entry.ride.constraint.GetWheelWorldTransform(
            index,
            scratch.axle,
            scratch.rim,
          )
          const pose = pooled(pool, poses.length, freshPose)
          writePose(pose, wheel.body, placed.GetTranslation(), placed.GetRotation().GetQuaternion())
          poses.push(pose)
        }
      }
      return poses
    },

    contacts: () => contacts,

    dispose: () => {
      for (const name of [...held.keys()]) forget(name)
      namesById.clear()
      targets.clear()
      for (const one of [
        listener,
        broadFilter,
        layerFilter,
        bodyFilter,
        shapeFilter,
        active,
        scratch.rim,
        scratch.axle,
        scratch.weight,
        scratch.up,
        scratch.identity,
        scratch.zero,
        scratch.vector,
        scratch.turn,
        scratch.place,
        world,
      ]) {
        jolt.destroy(one)
      }
    },
  }
}

/** Rewritten in place: a body's rotation is converted at BUILD, never inside a step. */
const SPUN = { x: 0, y: 0, z: 0, w: 1 }

const idOf = (jolt: JoltModule, pointer: number): number =>
  jolt.wrapPointer(pointer, jolt.Body).GetID().GetIndexAndSequenceNumber()

/** One idiom for every buffer of this port: what a step hands out is never allocated by a step. */
function pooled<T>(pool: T[], at: number, make: () => T): T {
  const kept = pool[at]
  if (kept) return kept

  const made = make()
  pool.push(made)
  return made
}

const freshPose = (): BodyPose => ({
  body: '',
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
})

const freshMotion = (): BodyMotion => ({
  body: '',
  linear: { x: 0, y: 0, z: 0 },
  angular: { x: 0, y: 0, z: 0 },
})

const freshContact = (): PhysicsContact => ({ body: '', other: '', started: false, sensed: false })

/** A pose read off whatever Jolt hands back — a body, a character, a wheel's world transform. */
function writePose(pose: BodyPose, name: string, at: JoltPlaceLike, spun: JoltQuatLike): void {
  pose.body = name
  pose.position.x = at.GetX()
  pose.position.y = at.GetY()
  pose.position.z = at.GetZ()
  pose.rotation.x = spun.GetX()
  pose.rotation.y = spun.GetY()
  pose.rotation.z = spun.GetZ()
  pose.rotation.w = spun.GetW()
}

type JoltPlaceLike = { GetX: () => number; GetY: () => number; GetZ: () => number }
type JoltQuatLike = JoltPlaceLike & { GetW: () => number }

const writeVector = (into: Vector3, read: JoltPlaceLike): void => {
  into.x = read.GetX()
  into.y = read.GetY()
  into.z = read.GetZ()
}

const writeContact = (
  contact: PhysicsContact,
  body: string,
  other: string,
  started: boolean,
  sensed: boolean,
): void => {
  contact.body = body
  contact.other = other
  contact.started = started
  contact.sensed = sensed
}

const sensorOf = (held: Map<string, Held>, name: string): boolean =>
  held.get(name)?.descriptor.sensor === true

/**
 * 🛑 A sensor is KINEMATIC whatever its author said: a Jolt sensor feels ACTIVE bodies only, so a
 * crate asleep in a trigger goes unreported unless the sensor is itself in motion's layer with
 * `mCollideKinematicVsNonDynamic` on. Rapier bought the same thing with `ActiveCollisionTypes`.
 */
function motionOf(jolt: JoltModule, descriptor: BodyDescriptor): number {
  if (descriptor.character !== null || descriptor.kind === 'kinematic' || descriptor.sensor) {
    return jolt.EMotionType_Kinematic
  }
  return descriptor.kind === 'dynamic' ? jolt.EMotionType_Dynamic : jolt.EMotionType_Static
}

function addedBody(
  jolt: JoltModule,
  bodies: InstanceType<JoltModule['BodyInterface']>,
  descriptor: BodyDescriptor,
  shape: JoltShape,
  scratch: Scratch,
): { id: JoltBodyId; body: JoltBody } {
  const motion = motionOf(jolt, descriptor)
  const layer = motion === jolt.EMotionType_Static ? NON_MOVING : MOVING
  const settings = new jolt.BodyCreationSettings(shape, scratch.place, scratch.turn, motion, layer)

  settings.mFriction = descriptor.friction
  settings.mRestitution = descriptor.restitution
  settings.mGravityFactor = descriptor.gravityScale
  settings.mIsSensor = descriptor.sensor
  // A kinematic body against a fixed one is OUT of Jolt's default set, which is exactly the pair
  // a trigger on the floor and a driven platform make.
  settings.mCollideKinematicVsNonDynamic = motion === jolt.EMotionType_Kinematic
  if (descriptor.sensor) settings.mAllowSleeping = false
  // Translation alone: an inertia made infinite still lets the solver turn the body a little.
  if (descriptor.lockRotation) {
    settings.mAllowedDOFs =
      jolt.EAllowedDOFs_TranslationX |
      jolt.EAllowedDOFs_TranslationY |
      jolt.EAllowedDOFs_TranslationZ
  }
  // 🛑 NOT divided by the pieces, unlike Rapier: Jolt weighs one shape once, so a solid carved
  // into thirty-two convexes weighs exactly what its author asked for.
  if (descriptor.mass > 0) {
    scratch.weight.mMass = descriptor.mass
    settings.mOverrideMassProperties = jolt.EOverrideMassProperties_CalculateInertia
    settings.mMassPropertiesOverride = scratch.weight
  }

  const made = bodies.CreateBody(settings)
  const id = new jolt.BodyID(made.GetID().GetIndexAndSequenceNumber())
  bodies.AddBody(id, jolt.EActivation_Activate)
  jolt.destroy(settings)
  return { id, body: made }
}

/**
 * 🛑 Forward is −Z here, as every other system of this tree reads it, where Jolt defaults to +Z:
 * the constraint AND each wheel are told so, or the car reverses on a forward pedal.
 */
function rideOf(
  jolt: JoltModule,
  system: InstanceType<JoltModule['PhysicsSystem']>,
  body: JoltBody,
  wanted: VehicleSettings,
  scratch: Scratch,
): Ride | null {
  if (wanted.wheels.length === 0) return null

  const settings = new jolt.VehicleConstraintSettings()
  settings.mMaxPitchRollAngle = MAX_PITCH_ROLL * DEGREES
  scratch.vector.Set(0, 0, -1)
  settings.mForward = scratch.vector
  settings.mWheels.clear()
  for (const wheel of wanted.wheels) {
    const one = new jolt.WheelSettingsWV()
    // 🛑 `at` is where the wheel RESTS; the spring is anchored one travel above it, so no caller
    // has to know where a spring is bolted.
    scratch.vector.Set(wheel.at.x, wheel.at.y + wanted.suspensionLength, wheel.at.z)
    one.mPosition = scratch.vector
    scratch.vector.Set(0, 0, -1)
    one.mWheelForward = scratch.vector
    one.mRadius = wanted.wheelRadius
    one.mWidth = wanted.wheelWidth
    one.mSuspensionMinLength = wanted.suspensionLength * SUSPENSION_SLACK
    one.mSuspensionMaxLength = wanted.suspensionLength
    one.mMaxSteerAngle = wheel.steers ? wanted.maxSteerAngle * DEGREES : 0
    one.mMaxHandBrakeTorque = wheel.handBraked ? HAND_BRAKE_TORQUE : 0
    settings.mWheels.push_back(one)
  }

  const controllerSettings = new jolt.WheeledVehicleControllerSettings()
  controllerSettings.mEngine.mMaxTorque = wanted.maxTorque
  controllerSettings.mDifferentials.clear()
  const axles = pairedByAxle(wanted.wheels)
  const driving = axles.filter(axle => axle.driven)
  for (const axle of driving) {
    const differential = new jolt.VehicleDifferentialSettings()
    differential.mLeftWheel = axle.left
    differential.mRightWheel = axle.right
    differential.mEngineTorqueRatio = 1 / driving.length
    // Copied INTO the array, unlike a wheel, which the array holds by reference.
    controllerSettings.mDifferentials.push_back(differential)
    jolt.destroy(differential)
  }
  settings.mController = controllerSettings

  settings.mAntiRollBars.clear()
  for (const axle of axles) {
    const bar = new jolt.VehicleAntiRollBar()
    bar.mLeftWheel = axle.left
    bar.mRightWheel = axle.right
    settings.mAntiRollBars.push_back(bar)
    jolt.destroy(bar)
  }

  const constraint = new jolt.VehicleConstraint(body, settings)
  constraint.AddRef()
  jolt.destroy(settings)
  const tester = new jolt.VehicleCollisionTesterCastCylinder(MOVING, WHEEL_CAST_ROUNDING)
  tester.AddRef()
  constraint.SetVehicleCollisionTester(tester)
  system.AddConstraint(constraint)
  // Without it the constraint is solved but never STEPPED: no suspension, no engine, no wheel.
  const listener = new jolt.VehicleConstraintStepListener(constraint)
  system.AddStepListener(listener)
  const controller = jolt.castObject(constraint.GetController(), jolt.WheeledVehicleController)
  return { constraint, listener, tester, controller, wheels: wanted.wheels }
}

type Axle = { left: number; right: number; driven: boolean }

/**
 * Wheels paired across the body, nearest by depth: what a differential and an anti-roll bar
 * join. A wheel with no opposite — three wheels, a trailer's lone one — is paired with nothing.
 */
function pairedByAxle(wheels: readonly VehicleWheel[]): Axle[] {
  const taken = new Set<number>()
  const axles: Axle[] = []
  wheels.forEach((wheel, index) => {
    if (taken.has(index) || wheel.at.x >= 0) return
    let opposite = -1
    let nearest = Number.POSITIVE_INFINITY
    wheels.forEach((other, at) => {
      const apart = Math.abs(other.at.z - wheel.at.z)
      if (taken.has(at) || other.at.x < 0 || apart >= nearest) return
      opposite = at
      nearest = apart
    })
    if (opposite < 0) return
    taken.add(index)
    taken.add(opposite)
    axles.push({ left: index, right: opposite, driven: wheel.driven && wheels[opposite]!.driven })
  })
  return axles
}

function walkerOf(
  jolt: JoltModule,
  system: InstanceType<JoltModule['PhysicsSystem']>,
  shape: JoltShape,
  wanted: NonNullable<BodyDescriptor['character']>,
  scratch: Scratch,
): Walker {
  const settings = new jolt.CharacterVirtualSettings()
  settings.mShape = shape
  settings.mUp = scratch.up
  settings.mMaxSlopeAngle = wanted.slopeLimit * DEGREES
  settings.mCharacterPadding = CHARACTER_SKIN
  // An inner body, or the rest of the world feels no character at all: a `CharacterVirtual` is a
  // shape swept through the scene, and is in no broadphase of its own.
  settings.mInnerBodyShape = shape
  settings.mInnerBodyLayer = MOVING

  const character = new jolt.CharacterVirtual(settings, scratch.place, scratch.turn, system)
  jolt.destroy(settings)

  const update = new jolt.ExtendedUpdateSettings()
  const down = new jolt.Vec3(0, -wanted.snapDistance, 0)
  const climb = new jolt.Vec3(0, wanted.stepHeight, 0)
  update.mStickToFloorStepDown = down
  update.mWalkStairsStepUp = climb
  jolt.destroy(down)
  jolt.destroy(climb)
  return { character, update }
}

/**
 * 🛑 Nothing here nests one SETTINGS inside another: a settings a parent holds is reference
 * counted, so destroying it frees what the parent still owns and the NEXT world reads a
 * corrupted heap. Children are built into SHAPES and composed.
 */
function builtShape(jolt: JoltModule, shape: ColliderShape, scratch: Scratch): JoltShape | null {
  if (shape.kind === 'hull') return hullOf(jolt, shape.points, scratch)
  if (shape.kind === 'convexes') {
    const pieces = shape.parts.map(points => hullOf(jolt, points, scratch)).filter(one => !!one)
    return pieces.length === 0 ? null : composed(jolt, pieces, null, scratch)
  }
  if (shape.kind === 'cuboid' && shape.at) {
    const box = createdShape(jolt, boxOf(jolt, shape.hx, shape.hy, shape.hz, scratch))
    return box ? composed(jolt, [box], shape.at, scratch) : null
  }
  return createdShape(jolt, leafOf(jolt, shape, scratch))
}

/** The settings go the moment the shape stands: only the shape is reference counted from here. */
function createdShape(jolt: JoltModule, settings: JoltShapeSettings): JoltShape | null {
  const result = settings.Create()
  const made = result.IsValid() ? result.Get() : null
  // Ours until whoever asked has taken its own reference.
  made?.AddRef()
  jolt.destroy(settings)
  return made
}

/**
 * The pieces put together, at an offset for a box read off a bounding box. A compound of ONE is
 * legal and measured — Jolt's own note recommends a rotated-translated shape instead, and that
 * one cannot be built without nesting a settings inside a settings.
 */
function composed(
  jolt: JoltModule,
  pieces: readonly JoltShape[],
  at: Vector3 | null,
  scratch: Scratch,
): JoltShape | null {
  const settings = new jolt.StaticCompoundShapeSettings()
  scratch.vector.Set(at?.x ?? 0, at?.y ?? 0, at?.z ?? 0)
  for (const piece of pieces) settings.AddShapeShape(scratch.vector, scratch.identity, piece, 0)

  const made = createdShape(jolt, settings)
  // The compound took its own references at `Create`; ours have done their work.
  for (const piece of pieces) piece.Release()
  return made
}

const boxOf = (
  jolt: JoltModule,
  hx: number,
  hy: number,
  hz: number,
  scratch: Scratch,
): JoltShapeSettings => {
  scratch.vector.Set(hx, hy, hz)
  return new jolt.BoxShapeSettings(
    scratch.vector,
    Math.min(CONVEX_RADIUS, Math.min(hx, hy, hz) / 2),
  )
}

function leafOf(jolt: JoltModule, shape: ColliderShape, scratch: Scratch): JoltShapeSettings {
  if (shape.kind === 'ball') return new jolt.SphereShapeSettings(shape.radius)
  if (shape.kind === 'capsule') {
    return new jolt.CapsuleShapeSettings(shape.halfHeight, shape.radius)
  }
  if (shape.kind === 'cylinder') {
    const corner = Math.min(CONVEX_RADIUS, shape.radius / 2, shape.halfHeight / 2)
    return new jolt.CylinderShapeSettings(shape.halfHeight, shape.radius, corner)
  }
  // Jolt has no cone: a tapered cylinder closed to a point is the same solid, and its rounded
  // corner goes with it — nothing can round a radius of zero.
  if (shape.kind === 'cone') {
    return new jolt.TaperedCylinderShapeSettings(shape.halfHeight, 0, shape.radius, 0)
  }
  if (shape.kind === 'trimesh') return meshOf(jolt, shape.vertices, shape.indices)
  if (shape.kind === 'cuboid') return boxOf(jolt, shape.hx, shape.hy, shape.hz, scratch)
  // `hull` and `convexes` are built above, where their pieces can be refused one by one.
  throw new Error(`no Jolt shape for ${shape.kind}`)
}

/** The generated declarations leave the vectors empty; the build carries their own methods. */
type PointCloud = InstanceType<JoltModule['ArrayVec3']> & {
  push_back: (point: JoltVector) => void
}

/**
 * 🛑 The floor is checked HERE and not left to Jolt: a hull of two points builds a settings object
 * all the same, and it is `Create` that then fails — from inside the WebAssembly, where nothing
 * says which body it was.
 */
function hullOf(jolt: JoltModule, points: Float32Array, scratch: Scratch): JoltShape | null {
  if (points.length < HULL_FLOOR * 3) return null

  const hull = new jolt.ConvexHullShapeSettings()
  // The generated declarations leave `ArrayVec3` empty; the build carries the vector's methods.
  const cloud = hull.mPoints as PointCloud
  for (let at = 0; at + 2 < points.length; at += 3) {
    scratch.vector.Set(points[at] ?? 0, points[at + 1] ?? 0, points[at + 2] ?? 0)
    cloud.push_back(scratch.vector)
  }
  return createdShape(jolt, hull)
}

function meshOf(jolt: JoltModule, vertices: Float32Array, indices: Uint32Array): JoltShapeSettings {
  const points = new jolt.VertexList()
  const triangles = new jolt.IndexedTriangleList()
  const corner = new jolt.Float3(0, 0, 0)
  const triangle = new jolt.IndexedTriangle(0, 0, 0, 0)

  for (let at = 0; at + 2 < vertices.length; at += 3) {
    corner.x = vertices[at] ?? 0
    corner.y = vertices[at + 1] ?? 0
    corner.z = vertices[at + 2] ?? 0
    points.push_back(corner)
  }
  for (let at = 0; at + 2 < indices.length; at += 3) {
    triangle.set_mIdx(0, indices[at] ?? 0)
    triangle.set_mIdx(1, indices[at + 1] ?? 0)
    triangle.set_mIdx(2, indices[at + 2] ?? 0)
    triangles.push_back(triangle)
  }

  const materials = new jolt.PhysicsMaterialList()
  const settings = new jolt.MeshShapeSettings(points, triangles, materials)
  for (const one of [points, triangles, corner, triangle, materials]) jolt.destroy(one)
  return settings
}
