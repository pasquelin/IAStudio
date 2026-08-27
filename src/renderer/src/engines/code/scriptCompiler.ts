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
  dispose: () => void
}

const spawn = (): Worker =>
  new Worker(new URL('./code.worker.ts', import.meta.url), { type: 'module' })

/**
 * 🛑 Held by the DIGEST of the source, not by the path: an author saves the same file thirty
 * times an hour and plays after every save, and the compiler is nine megabytes of parsing.
 */
export function createScriptCompiler(open: () => Worker = spawn): ScriptCompiler {
  const session = createWorkerSession<CodeRequest, CodeResponse>(open)
  const compiled = new Map<string, string>()

  return {
    compile: async sources => {
      const modules: ScriptModule[] = []
      const troubles: ScriptTrouble[] = []

      for (const one of sources) {
        const key = digest(one.source)
        const held = compiled.get(key)
        if (held !== undefined) {
          modules.push({ script: one.script, code: held })
          continue
        }

        const answer = await session.send({ id: session.nextId(), source: one.source })
        if ('trouble' in answer) {
          troubles.push({ script: one.script, message: answer.trouble, line: answer.line })
          continue
        }
        compiled.set(key, answer.code)
        modules.push({ script: one.script, code: answer.code })
      }

      return { modules, troubles }
    },

    dispose: () => session.dispose(),
  }
}
