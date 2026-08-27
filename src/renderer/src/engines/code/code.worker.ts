/// <reference lib="webworker" />
import { messageOf } from '@shared/guards'
import type { CodeRequest, CodeResponse } from './codeMessage'
import { transpile } from './transpile'

declare const self: DedicatedWorkerGlobalScope

/**
 * TypeScript to JavaScript, off the UI thread — CLAUDE.md invariant 6. The compiler is some nine
 * megabytes and parsing it is what would be felt, not the transpiling.
 *
 * A message adapter and nothing else: what it calls lives in `transpile.ts`, where a test reaches
 * it without a worker.
 */
self.addEventListener('message', (event: MessageEvent<CodeRequest>) => {
  const { id, source } = event.data

  try {
    const held = transpile(source)
    self.postMessage(('code' in held ? { id, ...held } : { id, ...held }) satisfies CodeResponse)
  } catch (error) {
    self.postMessage({ id, trouble: messageOf(error), line: 0 } satisfies CodeResponse)
  }
})
