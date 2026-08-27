// SPDX-License-Identifier: MIT

import type {
  BodyDescriptor,
  BodyPose,
  CharacterMove,
  CharacterMoved,
  PhysicsContact,
  PhysicsPort,
} from '../ports/physicsPort'

export type NotedPhysics = PhysicsPort & {
  added: BodyDescriptor[]
  removed: string[]
  placed: BodyPose[]
  asked: CharacterMove[]
  steps: number[]
  gravity: number
  /** What the next `poses` and `contacts` answer, so a case says what the engine decided. */
  answers: { poses: BodyPose[]; contacts: PhysicsContact[]; moved: CharacterMoved[] }
}

/** A physics that decides nothing and remembers everything — what a system is measured against. */
export function notedPhysics(): NotedPhysics {
  const noted: NotedPhysics = {
    added: [],
    removed: [],
    placed: [],
    asked: [],
    steps: [],
    gravity: 0,
    answers: { poses: [], contacts: [], moved: [] },

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
    step: dt => {
      noted.steps.push(dt)
    },
    poses: () => noted.answers.poses,
    contacts: () => noted.answers.contacts,
    dispose: () => {},
  }

  return noted
}
