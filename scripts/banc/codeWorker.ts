import { transpile } from '@/engines/code/transpile'
import type { CodeRequest, CodeResponse } from '@/engines/code/codeMessage'

/**
 * 🛑 A PLATFORM a headless run has not got, standing in for it — never a rule.
 *
 * jsdom has no `Worker`, and the studio's compiler asks for one by design (invariant 6: nine
 * megabytes of TypeScript must not be parsed on the thread that draws). What runs INSIDE is the
 * repository's own `transpile`, so what a bench measures is the studio's refusal, not a double's.
 */
export function standInForWorkers(): () => void {
  const held = globalThis.Worker
  globalThis.Worker = InlineWorker as unknown as typeof Worker
  return () => {
    globalThis.Worker = held
  }
}

class InlineWorker implements Pick<Worker, 'postMessage' | 'terminate'> {
  private readonly listeners: ((event: MessageEvent<CodeResponse>) => void)[] = []

  addEventListener(name: string, listener: (event: MessageEvent<CodeResponse>) => void): void {
    if (name === 'message') this.listeners.push(listener)
  }

  postMessage(message: CodeRequest): void {
    const held = transpile(message.source)
    const answer = { data: { id: message.id, ...held } } as MessageEvent<CodeResponse>
    // Deferred like a real one: a compiler that answered inside `postMessage` would resolve
    // before the caller had a promise to resolve.
    queueMicrotask(() => {
      for (const listener of this.listeners) listener(answer)
    })
  }

  terminate(): void {
    this.listeners.length = 0
  }
}
