// SPDX-License-Identifier: MIT

import type * as QuickJS from 'quickjs-emscripten-core'
import type { GameEvent } from '@shared/domain/gameEvent'
import { KERNEL } from '../script/kernel'
import type { ScriptFault, ScriptFrame, ScriptHook, ScriptOutcome } from '../script/frame'
import {
  FAULTS_BEFORE_DISARM,
  SCRIPT_BUDGET_MS,
  type ScriptModule,
  type ScriptPort,
} from '../ports/scriptPort'

type Engine = QuickJS.QuickJSWASMModule

const NOTHING: ScriptOutcome = { intents: [], faults: [] }

/**
 * 🛑 Held for the life of the window: the module instantiates its own WebAssembly, and a second
 * one would hand back a machine sharing nothing with the contexts already running.
 */
let engine: Promise<Engine> | null = null

/**
 * The sandbox, loaded on FIRST PLAY. Imported dynamically for the reason Rapier is: the machine
 * carries its WebAssembly inlined and weighs some 3 Mo, which no window that only draws needs.
 */
export async function loadQuickjsScripts(): Promise<ScriptPort> {
  engine ??= startEngine()

  let held: Engine
  try {
    held = await engine
  } catch (trouble) {
    engine = null
    throw trouble
  }
  return createQuickjsScripts(held)
}

async function startEngine(): Promise<Engine> {
  const core = await import('quickjs-emscripten-core')
  // The single-file variant: its WebAssembly is inlined, so nothing is fetched and the content
  // security policy has nothing to allow beyond `wasm-unsafe-eval`.
  const variant = (await import('@jitl/quickjs-singlefile-browser-release-sync')).default
  return await core.newQuickJSWASMModuleFromVariant(variant)
}

/** Takes the machine rather than reaching for it, so the load stays in one place above. */
function createQuickjsScripts(machine: Engine): ScriptPort {
  const runtime = machine.newRuntime()
  const context = runtime.newContext()
  const disarmed = new Set<string>()
  const faultCount = new Map<string, number>()
  let deadline = Number.POSITIVE_INFINITY
  runtime.setInterruptHandler(() => Date.now() > deadline)

  const evaluate = (code: string, file: string): string | ScriptFault => {
    const held = context.evalCode(code, file)
    if (held.error) {
      const said = context.dump(held.error)
      held.error.dispose()
      return faultOf(said, file)
    }
    const value = context.typeof(held.value) === 'string' ? context.getString(held.value) : ''
    held.value.dispose()
    return value
  }

  const invoke = (name: string, args: readonly string[]): string | ScriptFault => {
    const fn = context.getProp(context.global, name)
    const held = args.map(one => context.newString(one))
    const answer = context.callFunction(fn, context.undefined, ...held)
    for (const one of held) one.dispose()
    fn.dispose()

    if (answer.error) {
      const said = context.dump(answer.error)
      answer.error.dispose()
      return faultOf(said, name)
    }
    const value = context.getString(answer.value)
    answer.value.dispose()
    return value
  }

  /** Whoever was running when the machine was stopped — asked with the deadline pushed back. */
  const culprit = (): { script: string; entity: string } | null => {
    deadline = Number.POSITIVE_INFINITY
    const said = invoke('__current', [])
    if (typeof said !== 'string' || said.length === 0) return null
    const parsed: unknown = JSON.parse(said)
    return isCulprit(parsed) ? parsed : null
  }

  const blame = (fault: ScriptFault): ScriptFault => {
    const key = fault.entity ?? fault.script
    const count = (faultCount.get(key) ?? 0) + 1
    faultCount.set(key, count)
    if (count < FAULTS_BEFORE_DISARM || !fault.entity) return fault

    disarmed.add(fault.entity)
    invoke('__disarm', [fault.entity])
    return { ...fault, message: `${fault.message} — disarmed after ${count} faults` }
  }

  /** One hook over the whole frame, inside one budget. An overrun names its script and is out. */
  const drive = (name: string, args: readonly string[]): ScriptOutcome => {
    deadline = Date.now() + SCRIPT_BUDGET_MS
    const said = invoke(name, args)
    if (typeof said !== 'string') {
      const at = culprit()
      const fault: ScriptFault = at ? { ...said, script: at.script, entity: at.entity } : said
      // Straight out, without waiting for a third: a script that overran once will overrun again,
      // and it is the whole frame it takes with it.
      if (fault.entity) {
        disarmed.add(fault.entity)
        invoke('__disarm', [fault.entity])
      }
      return { intents: [], faults: [fault] }
    }
    deadline = Number.POSITIVE_INFINITY

    const outcome: unknown = JSON.parse(said)
    if (!isOutcome(outcome)) return NOTHING
    return { intents: outcome.intents, faults: outcome.faults.map(blame) }
  }

  const kernel = evaluate(KERNEL, 'kernel.js')
  if (typeof kernel !== 'string')
    throw new Error(`the sandbox kernel did not load: ${kernel.message}`)

  return {
    seed: value => {
      invoke('__seed', [String(value)])
    },

    load: modules => {
      const faults: ScriptFault[] = []
      for (const one of modules) {
        const held = evaluate(wrapped(one), fileOf(one.script))
        if (typeof held !== 'string') faults.push({ ...held, script: one.script })
      }
      return faults
    },

    attach: instances => {
      const said = invoke('__attach', [JSON.stringify(instances)])
      if (typeof said !== 'string') return [said]
      const parsed: unknown = JSON.parse(said)
      return Array.isArray(parsed) ? (parsed as ScriptFault[]) : []
    },

    detach: entities => {
      for (const entity of entities) {
        disarmed.delete(entity)
        faultCount.delete(entity)
      }
      invoke('__detach', [JSON.stringify(entities)])
    },

    run: (hook: ScriptHook, frame: ScriptFrame) => drive('__run', [hook, JSON.stringify(frame)]),

    deliver: (frame: ScriptFrame, events: readonly GameEvent[]) =>
      events.length === 0
        ? NOTHING
        : drive('__deliver', [JSON.stringify(frame), JSON.stringify(events)]),

    disarmed: () => [...disarmed],

    dispose: () => {
      context.dispose()
      runtime.dispose()
    },
  }
}

/**
 * The module, run for its `export default`. Transpiled to CommonJS by the studio, so what it
 * declares lands on `exports` — and any `require` it kept is a name the sandbox does not hold,
 * which is the refusal rather than an escape.
 */
const wrapped = (one: ScriptModule): string =>
  `;(function(){var exports={};var module={exports:exports};\n${one.code}\n__register(${JSON.stringify(one.script)}, exports.default||module.exports.default||null)})()`

/** What an editor opens. A script's reference is `script:<path>`, and the path is the file. */
const fileOf = (script: string): string => script.replace(/^script:/, '')

function faultOf(said: unknown, file: string): ScriptFault {
  const message =
    isRecordLike(said) && typeof said.message === 'string' ? said.message : String(said)
  const stack = isRecordLike(said) && typeof said.stack === 'string' ? said.stack : ''
  const at = /\(([^()]*):(\d+):(\d+)\)/.exec(stack)

  return {
    script: file,
    entity: null,
    message,
    // One less: the module is wrapped in a line of its own before it is evaluated.
    line: at ? Math.max(1, Number(at[2]) - 1) : 0,
    column: at ? Number(at[3]) : 0,
  }
}

const isRecordLike = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isCulprit = (value: unknown): value is { script: string; entity: string } =>
  isRecordLike(value) && typeof value.script === 'string' && typeof value.entity === 'string'

const isOutcome = (value: unknown): value is { intents: never[]; faults: ScriptFault[] } =>
  isRecordLike(value) && Array.isArray(value.intents) && Array.isArray(value.faults)
