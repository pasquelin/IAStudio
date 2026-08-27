// SPDX-License-Identifier: MIT

/**
 * 🛑 The only JavaScript this repository ships as TEXT, and it is deliberate: it is evaluated
 * INSIDE the sandbox, where no module of the studio can be imported and no bundler reaches. It is
 * therefore plain ES2020, and it is proved by what the port does rather than by a unit test.
 *
 * What it holds is the whole surface a script sees — `defineScript`, `game`, `self`, `ctx` — and
 * the dispatcher that lets one frame cross the bridge in a single call.
 */
export const KERNEL = String.raw`
;(function () {
  var scripts = new Map()
  var instances = new Map()
  var intents = []
  var faults = []
  var current = null
  var seed = 1

  function push(intent) { intents.push(intent) }

  function vector(x, y, z) {
    return { x: Number(x) || 0, y: Number(y) || 0, z: Number(z) || 0 }
  }

  // Mulberry32, the same draw the world uses, run INSIDE the machine: a random that crossed the
  // bridge would cost more than the number it carries, and would not replay.
  function draw() {
    seed = (seed + 0x6d2b79f5) >>> 0
    var t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  function refused(method) {
    push({ act: 'log', level: 'warn', message: 'game.ai.' + method + ' refused: notGranted' })
    return { ok: false, refused: 'notGranted' }
  }

  globalThis.defineScript = function (definition) { return definition }

  globalThis.game = {
    log: {
      info: function (message) { push({ act: 'log', level: 'info', message: String(message) }) },
      warn: function (message) { push({ act: 'log', level: 'warn', message: String(message) }) },
      error: function (message) { push({ act: 'log', level: 'error', message: String(message) }) },
    },
    events: {
      emit: function (name, payload) {
        push({ act: 'emit', name: String(name), entity: null, payload: payload || {} })
      },
    },
    spawn: function (name, at) {
      push({ act: 'spawn', name: String(name), at: at ? vector(at.x, at.y, at.z) : null })
    },
    random: {
      float: draw,
      int: function (low, high) { return low + Math.floor(draw() * (high - low)) },
    },
    // Named, refusing, and synchronous: a fixed step cannot wait on a promise, and the permission
    // to spend is not granted — see aiPort.ts.
    ai: {
      generateImage: function () { return refused('generateImage') },
      generateDialogue: function () { return refused('generateDialogue') },
      generateAudio: function () { return refused('generateAudio') },
    },
  }

  function selfOf(entity, held) {
    return {
      id: entity.entity,
      name: entity.name,
      props: held.props,
      position: entity.position,
      rotation: entity.rotation,
      get: function (type) {
        for (var i = 0; i < entity.components.length; i++) {
          if (entity.components[i].type === type) return entity.components[i]
        }
        return null
      },
      has: function (type) { return this.get(type) !== null },
      moveBy: function (x, y, z) { push({ act: 'move', entity: entity.entity, by: vector(x, y, z) }) },
      placeAt: function (x, y, z) { push({ act: 'place', entity: entity.entity, at: vector(x, y, z) }) },
      turnTo: function (x, y, z) { push({ act: 'turn', entity: entity.entity, to: vector(x, y, z) }) },
      set: function (type, key, value) {
        push({ act: 'field', entity: entity.entity, type: String(type), key: String(key), value: value })
      },
      say: function (name, payload) {
        push({ act: 'emit', name: String(name), entity: entity.entity, payload: payload || {} })
      },
      destroy: function () { push({ act: 'destroy', entity: entity.entity }) },
    }
  }

  function has(list, code) {
    for (var i = 0; i < list.length; i++) if (list[i] === code) return true
    return false
  }

  function contextOf(frame) {
    return {
      tick: frame.tick,
      dt: frame.dt,
      input: {
        down: function (code) { return has(frame.input.held, code) },
        pressed: function (code) { return has(frame.input.pressed, code) },
        released: function (code) { return has(frame.input.released, code) },
        pointer: frame.input.pointer,
      },
    }
  }

  // The line an editor would open, read off the stack QuickJS writes.
  function faultOf(error, script, entity) {
    var stack = (error && error.stack) || ''
    var at = /\(([^()]*):(\d+):(\d+)\)/.exec(stack)
    return {
      script: script,
      entity: entity,
      message: (error && error.message) || String(error),
      line: at ? Number(at[2]) : 0,
      column: at ? Number(at[3]) : 0,
    }
  }

  globalThis.__register = function (script, definition) {
    scripts.set(script, definition || null)
  }

  globalThis.__attach = function (payload) {
    var wanted = JSON.parse(payload)
    var refusals = []
    for (var i = 0; i < wanted.length; i++) {
      var one = wanted[i]
      var definition = scripts.get(one.script)
      if (!definition) {
        refusals.push({ script: one.script, entity: one.entity, message: 'script never loaded', line: 0, column: 0 })
        continue
      }
      instances.set(one.entity, { script: one.script, definition: definition, props: one.props })
    }
    return JSON.stringify(refusals)
  }

  globalThis.__detach = function (payload) {
    var gone = JSON.parse(payload)
    for (var i = 0; i < gone.length; i++) instances.delete(gone[i])
  }

  globalThis.__disarm = function (entity) { instances.delete(entity) }

  globalThis.__seed = function (value) { seed = Number(value) >>> 0 }

  /** Who was running when the machine was interrupted — read AFTER the deadline was pushed back. */
  globalThis.__current = function () { return current ? JSON.stringify(current) : '' }

  function call(hook, entity, held, self, ctx, dt, extra) {
    var fn = held.definition[hook]
    if (typeof fn !== 'function') return
    current = { script: held.script, entity: entity }
    try {
      fn(self, ctx, extra === undefined ? dt : extra)
    } catch (error) {
      faults.push(faultOf(error, held.script, entity))
    }
    current = null
  }

  globalThis.__run = function (hook, payload) {
    var frame = JSON.parse(payload)
    intents = []
    faults = []
    var ctx = contextOf(frame)
    for (var i = 0; i < frame.entities.length; i++) {
      var entity = frame.entities[i]
      var held = instances.get(entity.entity)
      if (!held) continue
      call(hook, entity.entity, held, selfOf(entity, held), ctx, frame.dt)
    }
    return JSON.stringify({ intents: intents, faults: faults })
  }

  var HOOKS = {
    Collided: 'onCollision',
    TriggerEntered: 'onTriggerEnter',
    TriggerExited: 'onTriggerExit',
  }

  globalThis.__deliver = function (payload, events) {
    var frame = JSON.parse(payload)
    var delivered = JSON.parse(events)
    intents = []
    faults = []
    var ctx = contextOf(frame)
    var byId = new Map()
    for (var i = 0; i < frame.entities.length; i++) byId.set(frame.entities[i].entity, frame.entities[i])

    for (var e = 0; e < delivered.length; e++) {
      var event = delivered[e]
      // The one it happened TO hears its own hook; everyone hears onMessage.
      var subject = event.entity ? byId.get(event.entity) : null
      var held = event.entity ? instances.get(event.entity) : null
      var named = HOOKS[event.name]
      if (subject && held && named) call(named, event.entity, held, selfOf(subject, held), ctx, 0, event)

      for (var k = 0; k < frame.entities.length; k++) {
        var listener = frame.entities[k]
        var heard = instances.get(listener.entity)
        if (!heard) continue
        call('onMessage', listener.entity, heard, selfOf(listener, heard), ctx, 0, event)
      }
    }
    return JSON.stringify({ intents: intents, faults: faults })
  }
})()
`
