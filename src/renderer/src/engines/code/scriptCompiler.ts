import { digest } from '@shared/hash'
import type { ScriptModule } from '@game/ports/scriptPort'
import { createWorkerSession } from '../core/workerSession'
import type { CodeRequest, CodeResponse } from './codeMessage'

/** A script that would not compile, said where an editor could open it. */
export type ScriptTrouble = { script: string; message: string; line: number }

export type ScriptCompiler = {
  /** Every script, compiled once. What came back unchanged is served from the cache. */
  compile: (
    sources: readonly { script: string; source: string }[],
  ) => Promise<{ modules: ScriptModule[]; troubles: ScriptTrouble[] }>
}

const spawn = (): Worker =>
  new Worker(new URL('./code.worker.ts', import.meta.url), { type: 'module' })

/**
 * 🛑 Held by the DIGEST of the source, not by the path: an author saves the same file thirty times
 * an hour and plays after every save, and the compiler is nine megabytes of parsing. Kept for the
 * window with no way to close it, deliberately — the next Play would pay that parse again.
 */
export function createScriptCompiler(open: () => Worker = spawn): ScriptCompiler {
  const session = createWorkerSession<CodeRequest, CodeResponse>(open)
  const compiled = new Map<string, string>()

  return {
    compile: async sources => {
      const keyed = sources.map(one => ({ ...one, key: digest(one.source) }))
      const asked = new Set<string>()
      // Sent TOGETHER: the worker answers by `id`, so what is waiting is one round trip rather
      // than one per script — a project of thirty would otherwise queue thirty latencies.
      const fresh = await Promise.all(
        keyed
          .filter(one => !compiled.has(one.key) && !asked.has(one.key) && asked.add(one.key))
          .map(async one => ({
            ...one,
            answer: await session.send({ id: session.nextId(), source: one.source }),
          })),
      )

      const troubles: ScriptTrouble[] = []
      const refused = new Set<string>()
      for (const one of fresh) {
        if ('trouble' in one.answer) {
          troubles.push({ script: one.script, message: one.answer.trouble, line: one.answer.line })
          refused.add(one.script)
          continue
        }
        compiled.set(one.key, one.answer.code)
      }

      const modules: ScriptModule[] = []
      for (const one of keyed) {
        const held = compiled.get(one.key)
        if (held !== undefined && !refused.has(one.script))
          modules.push({ script: one.script, code: held })
      }
      return { modules, troubles }
    },
  }
}
