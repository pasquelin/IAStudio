// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest'
import { newComponent, withComponentField } from '@shared/domain/componentRegistry'
import type { Component, JsonValue } from '@shared/domain/component'
import { DEFAULT_PLAY } from '@shared/domain/scene'
import { notedPhysics, type NotedPhysics } from '../../physics/physics-fixtures'
import { createCharacters } from '../characters'
import { createPossessions } from '../possessions'
import { restingTransform, type Entity } from '../entity'
import { STEP_SECONDS } from '../gameLoop'
import { createRigs, type Rigs } from '../rigs'
import { testPorts, testWorld } from '../world-fixtures'
import type { World } from '../world'
import { createSpringArmSystem } from './springArm'

const FRAME = 1 / 60

const armed = (over: Record<string, JsonValue> = {}): Component => {
  let arm = newComponent('SpringArm')
  for (const [key, value] of Object.entries({ subject: 'hero', camera: 'eye', ...over })) {
    arm = withComponentField(arm, key, value)
  }
  return arm
}

function rigged(
  over: Record<string, JsonValue> = {},
  filmable: (entity: Entity) => boolean = () => true,
): {
  world: World
  rigs: Rigs
  physics: NotedPhysics
  hero: Entity
  eye: Entity
} {
  const physics = notedPhysics()
  const rigs = createRigs(null)
  const world = testWorld({
    play: { ...DEFAULT_PLAY, camera: 'thirdPerson' },
    ports: testPorts({ physics }),
    systems: [
      createSpringArmSystem({
        characters: createCharacters(createPossessions()),
        rigs,
        // Flat: every node of these cases hangs from nothing, so its own frame IS the world's.
        worldOf: (_, own) => own,
        localOf: () => null,
        filmable,
      }),
    ],
  })
  world.entities.add({ id: 'hero', name: 'hero', transform: restingTransform(), components: [] })
  world.entities.add({ id: 'eye', name: 'eye', transform: restingTransform(), components: [] })
  world.entities.add({
    id: 'arm',
    name: 'arm',
    transform: restingTransform(),
    components: [armed(over)],
  })

  return {
    world,
    rigs,
    physics,
    hero: world.entities.get('hero')!,
    eye: world.entities.get('eye')!,
  }
}

describe('the arm a camera hangs on', () => {
  it('hangs the camera behind the subject, at the length and the height asked for', () => {
    const { world, eye } = rigged({ length: 4, height: 1.6 })

    world.lateUpdate(0, FRAME)

    // A look of zero points down −Z, so the camera stands four metres the other way.
    expect(eye.transform.position).toEqual({ x: 0, y: 1.6, z: 4 })
  })

  it('pushes the camera off the centre line by the shoulder asked for', () => {
    const { world, eye } = rigged({ shoulder: 0.7 })

    world.lateUpdate(0, FRAME)

    expect(eye.transform.position.x).toBeCloseTo(0.7, 6)
  })

  it('names the camera it placed, so one system alone composes the shot', () => {
    const { world, rigs, eye } = rigged()

    world.lateUpdate(0, FRAME)

    expect(rigs.leader()).toBe(eye)
  })

  it('pulls the camera in to what stands between it and its subject', () => {
    const { world, physics, eye } = rigged({ length: 4, height: 0 })
    physics.answers.cast = 0.25

    world.lateUpdate(0, FRAME)

    expect(eye.transform.position.z).toBeCloseTo(1, 6)
    // The subject and the camera are both left out, or the arm butts against what it films.
    expect(physics.probes[0]?.ignore).toEqual(['hero', 'eye'])
    expect(physics.probes[0]?.radius).toBe(0.2)
  })

  it('probes nothing at all when it is told not to avoid walls', () => {
    const { world, physics } = rigged({ collision: false })

    world.lateUpdate(0, FRAME)

    expect(physics.probes).toEqual([])
  })

  /**
   * 🛑 The whole reason a late pass is handed the frame's seconds. Written against a constant per
   * frame, the same lag settles twice as fast on a screen drawing twice as often.
   */
  it('lags by the same amount whether the screen draws once or twice', () => {
    const slow = rigged({ positionLag: 0.2 })
    const fast = rigged({ positionLag: 0.2 })
    slow.world.lateUpdate(0, FRAME)
    fast.world.lateUpdate(0, FRAME)

    slow.hero.transform.position.x = 10
    fast.hero.transform.position.x = 10
    slow.world.lateUpdate(0, 1 / 30)
    fast.world.lateUpdate(0, FRAME)
    fast.world.lateUpdate(0, FRAME)

    expect(fast.eye.transform.position.x).toBeCloseTo(slow.eye.transform.position.x, 6)
    // And it really did lag: a camera that snapped would already stand at ten.
    expect(slow.eye.transform.position.x).toBeLessThan(9)
  })

  it('takes the subject up at once on the frame it first sees it', () => {
    const { world, hero, eye } = rigged({ positionLag: 0.2 })
    hero.transform.position.x = 10

    world.lateUpdate(0, FRAME)

    expect(eye.transform.position.x).toBeCloseTo(10, 6)
  })

  /** Everything else is drawn between two steps; what the picture hangs on must be too. */
  it('anchors on the subject where it is drawn, not where the last step left it', () => {
    const { world, hero, eye } = rigged({ positionLag: 0 })
    hero.transform.position.x = 4
    world.step(STEP_SECONDS)
    hero.transform.position.x = 6

    world.lateUpdate(0.5, FRAME)

    expect(eye.transform.position.x).toBeCloseTo(5, 6)
  })

  it('aims down the subject own nose when it is told to follow it', () => {
    const { world, hero, eye } = rigged({ orientation: 'subject', length: 4, height: 0 })
    // A quarter turn to the left: the subject now faces −X, so the arm stands at +X behind it.
    hero.transform.rotation.y = Math.PI / 2

    world.lateUpdate(0, FRAME)

    expect(eye.transform.position.x).toBeCloseTo(4, 5)
    expect(eye.transform.position.z).toBeCloseTo(0, 5)
  })

  it('turns the camera back towards what it films', () => {
    const { world, hero, eye } = rigged({ orientation: 'subject', length: 4, height: 0 })
    hero.transform.rotation.y = Math.PI / 2

    world.lateUpdate(0, FRAME)

    expect(eye.transform.rotation.y).toBeCloseTo(Math.PI / 2, 5)
  })

  /**
   * 🛑 `turnTowards` leaves a rotation alone for a direction of NOTHING, and the camera sits ON
   * the pivot whenever the arm is short or the probe leaves no room — so it would keep whatever
   * was written before. TWO turns, or the module scratch answers the first by having held it.
   */
  it('still looks where the arm points when the arm has no length', () => {
    const { world, hero, eye } = rigged({ orientation: 'subject', length: 0, rotationLag: 0 })
    hero.transform.rotation.y = Math.PI / 2
    world.lateUpdate(0, FRAME)
    const first = eye.transform.rotation.y

    hero.transform.rotation.y = -Math.PI / 2
    world.lateUpdate(0, FRAME)

    expect(first).toBeCloseTo(Math.PI / 2, 5)
    expect(eye.transform.rotation.y).toBeCloseTo(-Math.PI / 2, 5)
  })

  it('still looks where the arm points when the probe leaves no room at all', () => {
    const { world, physics, hero, eye } = rigged({
      orientation: 'subject',
      length: 4,
      rotationLag: 0,
    })
    physics.answers.cast = 0
    hero.transform.rotation.y = Math.PI / 2
    world.lateUpdate(0, FRAME)
    const first = eye.transform.rotation.y

    hero.transform.rotation.y = -Math.PI / 2
    world.lateUpdate(0, FRAME)

    expect(first).toBeCloseTo(Math.PI / 2, 5)
    expect(eye.transform.rotation.y).toBeCloseTo(-Math.PI / 2, 5)
  })

  /**
   * 🛑 An arm on a MESH places it and stops there. Filming through it would take the shot from
   * inside the model — measured, before the window was asked what a camera is.
   */
  it('places a node that is not a camera without filming through it', () => {
    const { world, rigs, eye } = rigged({ length: 4, height: 1.6 }, () => false)

    world.lateUpdate(0, FRAME)

    expect(eye.transform.position).toEqual({ x: 0, y: 1.6, z: 4 })
    expect(rigs.leader()).toBeNull()
  })

  it('does nothing at all for an arm whose subject or camera nobody wears', () => {
    const { world, eye } = rigged({ subject: 'nobody' })

    world.lateUpdate(0, FRAME)

    expect(eye.transform.position).toEqual({ x: 0, y: 0, z: 0 })
  })
})
