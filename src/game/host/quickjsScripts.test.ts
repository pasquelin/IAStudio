// SPDX-License-Identifier: MIT

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { InputState } from '../ports/inputPort'
import type { ScriptPort } from '../ports/scriptPort'
import type { ScriptEntity, ScriptFrame } from '../script/frame'
import { loadQuickjsScripts } from './quickjsScripts'

const IDLE: InputState = {
  held: [],
  pressed: [],
  released: [],
  pointer: { x: 0, y: 0, down: false },
}

const walker = (over: Partial<ScriptEntity> = {}): ScriptEntity => ({
  entity: 'e1',
  name: 'Walker',
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  components: [],
  props: {},
  ...over,
})

const frameOf = (entities: readonly ScriptEntity[], input = IDLE): ScriptFrame => ({
  tick: 1,
  dt: 1 / 60,
  input,
  entities,
})

/** What the studio's transpiler hands over: CommonJS, one `export default`. */
const compiled = (body: string): string => `exports.default = defineScript({ ${body} })`

describe('the sandbox a game runs its own code in', () => {
  let port: ScriptPort

  beforeEach(async () => {
    port = await loadQuickjsScripts()
  })

  afterEach(() => {
    port.dispose()
  })

  const running = (body: string, over: Partial<ScriptEntity> = {}) => {
    expect(port.load([{ script: 'script:Walk.ts', code: compiled(body) }])).toEqual([])
    expect(port.attach([{ entity: 'e1', script: 'script:Walk.ts', props: { speed: 3 } }])).toEqual(
      [],
    )
    return port.run('onUpdate', frameOf([walker(over)]))
  }

  it('turns a script into what the world should do, and nothing else', () => {
    const outcome = running('onUpdate(self, ctx, dt) { self.moveBy(0, 0, -self.props.speed * dt) }')

    expect(outcome.faults).toEqual([])
    expect(outcome.intents).toEqual([{ act: 'move', entity: 'e1', by: { x: 0, y: 0, z: -3 / 60 } }])
  })

  it('reads the keys under the fingers of whoever is playing', () => {
    expect(
      port.load([
        {
          script: 'script:Walk.ts',
          code: compiled(
            'onUpdate(self, ctx) { if (ctx.input.down("KeyW")) self.moveBy(0, 0, -1) }',
          ),
        },
      ]),
    ).toEqual([])
    port.attach([{ entity: 'e1', script: 'script:Walk.ts', props: {} }])

    const still = port.run('onUpdate', frameOf([walker()]))
    const held = port.run('onUpdate', frameOf([walker()], { ...IDLE, held: ['KeyW'] }))

    expect(still.intents).toEqual([])
    expect(held.intents).toEqual([{ act: 'move', entity: 'e1', by: { x: 0, y: 0, z: -1 } }])
  })

  it('reads the components its entity carries', () => {
    const outcome = running(
      'onUpdate(self) { const health = self.get("Health"); if (health) game.log.info("hp " + health.current) }',
      { components: [{ type: 'Health', max: 100, current: 40 }] },
    )

    expect(outcome.intents).toEqual([{ act: 'log', level: 'info', message: 'hp 40' }])
  })

  /** 🛑 The whole reason the sandbox exists: a game's code is not trusted to be reachable. */
  it('has no way out — no fetch, no socket, no clock, no require', () => {
    const outcome = running(
      'onUpdate() { game.log.info([typeof fetch, typeof WebSocket, typeof XMLHttpRequest, typeof localStorage, typeof process, typeof require].join(",")) }',
    )

    expect(outcome.intents).toEqual([
      {
        act: 'log',
        level: 'info',
        message: 'undefined,undefined,undefined,undefined,undefined,undefined',
      },
    ])
  })

  /** 🛑 The second reason: the studio must not freeze because a script did. */
  it('interrupts a script that will not stop, names it, and never runs it again', () => {
    const started = Date.now()
    const outcome = running('onUpdate() { while (true) {} }')
    const took = Date.now() - started

    expect(outcome.faults[0]?.entity).toBe('e1')
    expect(outcome.faults[0]?.script).toBe('script:Walk.ts')
    expect(port.disarmed()).toEqual(['e1'])
    expect(took).toBeLessThan(200)

    // And the frame after it is clean: the loop is out of the world, not retried.
    expect(port.run('onUpdate', frameOf([walker()]))).toEqual({ intents: [], faults: [] })
  })

  it('says where a script threw, with the line an editor would open', () => {
    const outcome = running('onUpdate() { throw new Error("no") }')

    expect(outcome.faults[0]?.message).toBe('no')
    expect(outcome.faults[0]?.entity).toBe('e1')
    expect(outcome.faults[0]?.line).toBeGreaterThan(0)
  })

  /** One bad frame is a bug; three is a script nobody should keep paying for. */
  it('disarms a script that throws over and over', () => {
    running('onUpdate() { throw new Error("no") }')
    port.run('onUpdate', frameOf([walker()]))
    const third = port.run('onUpdate', frameOf([walker()]))

    expect(third.faults[0]?.message).toContain('disarmed')
    expect(port.disarmed()).toEqual(['e1'])
  })

  it('refuses a script that names a module, rather than running half of it', () => {
    const faults = port.load([
      { script: 'script:Bad.ts', code: 'const three = require("three"); exports.default = three' },
    ])

    expect(faults[0]?.script).toBe('script:Bad.ts')
    expect(faults[0]?.message).toContain('require')
  })

  /** A game that cannot be replayed cannot be tested, predicted over a network, or reported. */
  it('draws the same numbers from the same seed', () => {
    port.seed(7)
    const once = running('onUpdate() { game.log.info(String(game.random.int(0, 1000))) }')
    port.seed(7)
    const twice = port.run('onUpdate', frameOf([walker()]))

    expect(twice.intents).toEqual(once.intents)
    expect(once.intents).toHaveLength(1)
  })

  it('delivers what happened to the entity it happened to', () => {
    port.load([
      {
        script: 'script:Walk.ts',
        code: compiled(
          'onCollision(self, ctx, event) { game.log.info("hit " + event.payload.other) }',
        ),
      },
    ])
    port.attach([{ entity: 'e1', script: 'script:Walk.ts', props: {} }])

    const outcome = port.deliver(frameOf([walker()]), [
      { name: 'Collided', entity: 'e1', payload: { other: 'wall' } },
    ])

    expect(outcome.intents).toEqual([{ act: 'log', level: 'info', message: 'hit wall' }])
  })
})
