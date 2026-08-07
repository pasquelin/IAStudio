import { utilityProcess } from 'electron'
import { join } from 'node:path'
import { createPeaksClient, type PeaksClient, type PeaksPort } from './peaks-client'
import type { PeaksResponse } from './peaks-protocol'

/**
 * The waveform worker, forked once and kept for the session. One process, not one per file:
 * the ingest pool already bounds how many run at a time, and forking per rush would pay a
 * process launch for every ten seconds of audio.
 *
 * Lazy, because most sessions never import a sound at all.
 */
export function openPeaksProcess(): PeaksClient {
  // Resolved beside the bundled main, where `peaks-worker` is its own entry point — see
  // `electron.vite.config.ts`.
  const child = utilityProcess.fork(join(__dirname, 'peaks-worker.js'))

  const port: PeaksPort = {
    postMessage: message => child.postMessage(message),
    onMessage: listener => {
      child.on('message', (response: PeaksResponse) => listener(response))
    },
    onFailure: listener => {
      // A process that exits on its own leaves the same callers waiting as one that threw.
      child.on('exit', (code: number) => {
        if (code !== 0) listener(new Error(`waveform process exited with code ${code}`))
      })
    },
  }

  return createPeaksClient(port)
}
