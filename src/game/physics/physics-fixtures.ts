// SPDX-License-Identifier: MIT

import type {
  BodyDescriptor,
  BodyForce,
  BodyMotion,
  BodyPose,
  CharacterMove,
  CharacterMoved,
  PhysicsContact,
  PhysicsPort,
  VehicleDrive,
} from '../ports/physicsPort'

export type NotedPhysics = PhysicsPort & {
  added: BodyDescriptor[]
  removed: string[]
  placed: BodyPose[]
  asked: CharacterMove[]
  driven: VehicleDrive[]
  pushed: BodyForce[]
  steps: number[]
  gravity: number
  /** What the next `poses` and `contacts` answer, so a case says what the engine decided. */
  answers: {
    poses: BodyPose[]
    contacts: PhysicsContact[]
    moved: CharacterMoved[]
    motion: BodyMotion[]
  }
}

/** A physics that decides nothing and remembers everything — what a system is measured against. */
export function notedPhysics(): NotedPhysics {
  const noted: NotedPhysics = {
    added: [],
    removed: [],
    placed: [],
    asked: [],
    driven: [],
    pushed: [],
    steps: [],
    gravity: 0,
    answers: { poses: [], contacts: [], moved: [], motion: [] },

    setGravity: y => {
      noted.gravity = y
    },
    add: bodies => {
      noted.added.push(...bodies)
      return []
    },
    remove: bodies => {
      noted.removed.push(...bodies)
    },
    place: poses => {
      noted.placed.push(...poses.map(pose => ({ ...pose, position: { ...pose.position } })))
    },
    moveCharacters: wanted => {
      noted.asked.push(...wanted.map(one => ({ ...one, wanted: { ...one.wanted } })))
      return noted.answers.moved
    },
    drive: wanted => {
      noted.driven.push(...wanted.map(one => ({ ...one })))
    },
    push: forces => {
      noted.pushed.push(
        ...forces.map(one => ({ ...one, force: { ...one.force }, torque: { ...one.torque } })),
      )
    },
    // In the ORDER ASKED, as the real port answers: both callers walk a cursor over the result,
    // and a double answering in its own order would exercise the « port does not hold it » path.
    motion: bodies => bodies.flatMap(body => noted.answers.motion.filter(one => one.body === body)),
    step: dt => {
      noted.steps.push(dt)
    },
    poses: () => noted.answers.poses,
    contacts: () => noted.answers.contacts,
    dispose: () => {},
  }

  return noted
}
