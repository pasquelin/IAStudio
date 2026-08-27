// SPDX-License-Identifier: MIT

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Component } from '@shared/domain/component'
import { newComponent, withComponentField } from '@shared/domain/componentRegistry'
import { loadQuickjsScripts } from '../../host/quickjsScripts'
import type { ScriptFault } from '../../script/frame'
import type { ScriptPort } from '../../ports/scriptPort'
import { restingTransform } from '../entity'
import { testPorts, testWorld } from '../world-fixtures'
import type { World } from '../world'
import { createScriptSystem } from './script'

const STEP = 1 / 60
const WALK = 'script:Walk.ts'

const scripted = (body: string): string => `exports.default = defineScript({ ${body} })`

/** A real sandbox: what this measures is the SYSTEM, and a fake one would prove nothing of it. */
describe('what a game does with its own code', () => {
  let port: ScriptPort
  let faults: ScriptFault[]

  beforeEach(async () => {
    port = await loadQuickjsScripts()
    faults = []
  })

  afterEach(() => {
    port.dispose()
  })

  function running(body: string, components: Component[] = []): World {
    const world = testWorld({
      ports: testPorts({ script: port }),
      systems: [
        createScriptSystem({
          modules: [{ script: WALK, code: scripted(body) }],
          onFault: fault => faults.push(fault),
        }),
      ],
    })
    world.entities.add({
      id: 'e1',
      name: 'Walker',
      transform: restingTransform(),
      components: [withComponentField(newComponent('Script'), 'script', WALK), ...components],
    })
    return world
  }

  /** 🛑 The measure the lot is for: twenty lines of an author's code move something. */
  it('moves what a script tells it to move', () => {
    const world = running('onUpdate(self, ctx, dt) { self.moveBy(0, 0, -4 * dt) }')

    world.step(STEP)
    world.step(STEP)

    expect(world.entities.get('e1')?.transform.position.z).toBeCloseTo(-8 / 60, 6)
  })

  it('writes a field of a component the entity already carries', () => {
    const world = running('onUpdate(self) { self.set("Health", "current", 40) }', [
      newComponent('Health'),
    ])

    world.step(STEP)

    expect(world.entities.get('e1')?.components.find(one => one.type === 'Health')?.current).toBe(
      40,
    )
  })

  /** A script cannot invent a component the studio has no descriptor for. */
  it('refuses to write a component the entity does not carry', () => {
    const world = running('onUpdate(self) { self.set("Weapon", "damage", 9) }')

    world.step(STEP)

    expect(world.entities.get('e1')?.components.map(one => one.type)).toEqual(['Script'])
  })

  it('spawns and destroys through the world, so both land at the end of the step', () => {
    const world = running('onStart(self) { game.spawn("Crate", { x: 1, y: 2, z: 3 }) }')

    world.step(STEP)

    const born = [...world.entities.all()].find(one => one.name === 'Crate')
    expect(born?.transform.position).toEqual({ x: 1, y: 2, z: 3 })
  })

  /** A name the closed union does not hold rides as DATA, which is what `Custom` is for. */
  it('puts what a script says on the bus as a custom event', () => {
    const world = running('onUpdate(self) { self.say("DoorOpened", { door: "north" }) }')
    const heard: string[] = []
    world.events.on('Custom', event =>
      heard.push(`${String(event.payload.name)}/${String(event.payload.door)}`),
    )

    world.step(STEP)
    world.step(STEP)

    expect(heard).toContain('DoorOpened/north')
  })

  it('hands an event to the script of the entity it happened to', () => {
    const world = running(
      'onCollision(self, ctx, event) { game.log.info("hit " + event.payload.other) }',
    )

    world.step(STEP)
    world.events.emit({ name: 'Collided', entity: 'e1', payload: { other: 'wall' } })
    world.step(STEP)
    world.step(STEP)

    expect(world.ports.log.recent().map(entry => entry.message)).toContain('hit wall')
  })

  /** 🛑 The studio does not freeze, the fault is addressable, and the game keeps running. */
  it('survives a script that will not stop, and says which one it was', () => {
    const world = running('onUpdate() { while (true) {} }')

    world.step(STEP)
    world.step(STEP)

    expect(faults[0]?.script).toBe(WALK)
    expect(faults[0]?.entity).toBe('e1')
    expect(world.entities.count()).toBe(1)
  })

  it('forgets a script with the entity that carried it', () => {
    const world = running('onUpdate(self) { self.moveBy(0, 1, 0) }')

    world.step(STEP)
    world.destroy('e1')
    world.step(STEP)
    world.step(STEP)

    expect(faults).toEqual([])
    expect(world.entities.count()).toBe(0)
  })

  /** 🛑 Once per entity, for the entity that JOINED — not for everyone already running. */
  it('opens a script once, however many entities join later', () => {
    const world = running('onCreate(self) { game.log.info("born " + self.id) }')

    world.step(STEP)
    world.entities.add({
      id: 'e2',
      name: 'Second',
      transform: restingTransform(),
      components: [withComponentField(newComponent('Script'), 'script', WALK)],
    })
    world.step(STEP)
    world.step(STEP)

    const said = world.ports.log.recent().map(entry => entry.message)
    expect(said.filter(one => one === 'born e1')).toHaveLength(1)
    expect(said.filter(one => one === 'born e2')).toHaveLength(1)
  })

  /** 🛑 For the one that DIED, and where it died — a frame swept from the world holds neither. */
  it('closes a script for the entity that left, not for the ones that stayed', () => {
    const world = running(
      'onDestroy(self) { game.log.info("gone " + self.id + " at " + self.position.y) }',
    )
    world.entities.add({
      id: 'e2',
      name: 'Second',
      transform: { ...restingTransform(), position: { x: 0, y: 7, z: 0 } },
      components: [withComponentField(newComponent('Script'), 'script', WALK)],
    })

    world.step(STEP)
    world.destroy('e2')
    world.step(STEP)
    world.step(STEP)

    const said = world.ports.log.recent().map(entry => entry.message)
    expect(said).toContain('gone e2 at 7')
    expect(said.some(one => one.startsWith('gone e1'))).toBe(false)
  })

  /** 🛑 The whole point of the inspector rows: one script, two entities, two settings. */
  it('hands each entity the settings its own component carries', () => {
    const world = testWorld({
      ports: testPorts({ script: port }),
      systems: [
        createScriptSystem({
          modules: [
            {
              script: WALK,
              code: scripted(
                'props: { speed: 1 }, onUpdate(self) { game.log.info(self.id + " at " + self.props.speed) }',
              ),
            },
          ],
          onFault: fault => faults.push(fault),
        }),
      ],
    })
    const carrying: readonly [string, number | undefined][] = [
      ['e1', 7],
      ['e2', undefined],
    ]
    for (const [id, speed] of carrying) {
      world.entities.add({
        id,
        name: id,
        transform: restingTransform(),
        components: [
          {
            ...withComponentField(newComponent('Script'), 'script', WALK),
            ...(speed === undefined ? {} : { props: { speed } }),
          },
        ],
      })
    }

    world.step(STEP)

    const said = world.ports.log.recent().map(entry => entry.message)
    expect(said).toContain('e1 at 7')
    expect(said).toContain('e2 at 1')
  })

  /** What the sandbox is asked is what somebody WROTE: the rest never crosses the bridge. */
  it('asks the sandbox for nothing when no script declares the hook', () => {
    const world = running('onUpdate(self) { self.moveBy(0, 1, 0) }')
    world.step(STEP)

    expect(port.declares('onUpdate')).toBe(true)
    expect(port.declares('onLateUpdate')).toBe(false)
    expect(port.declares('onMessage')).toBe(false)
  })
})
