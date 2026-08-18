import { readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { CHANNELS } from '@shared/ipc'
import { sourceFiles, WHOLE_PROJECT } from './sourceFiles'

/**
 * Every channel the boundary declares is answered by something.
 *
 * The compiler already pairs a channel with the bridge method it must implement — see
 * `ChannelMethod` in `ipc/handle.ts` — and knip already refuses a `register…Handlers` nobody
 * calls. Neither of them notices a channel that was DECLARED and never handed to `handle()`:
 * the window then invokes it, Electron answers « no handler registered », and the failure
 * surfaces as a rejected promise inside a component rather than as a red gate.
 *
 * Measured on 18/08 while asking whether a new channel was really wired: 149 declared, 149
 * handled. There is no exemption, and there must not become one — a channel nothing answers is
 * a feature that cannot work, not a case to write down.
 */
describe('the IPC boundary', () => {
  const handled = new Set<string>()
  for (const path of sourceFiles(dirname(fileURLToPath(import.meta.url)))) {
    for (const [, name] of readFileSync(path, 'utf8').matchAll(/handle\(CHANNELS\.(\w+)/g)) {
      if (name) handled.add(name)
    }
  }

  it(
    'hands every declared channel to a handler',
    () => {
      expect(Object.keys(CHANNELS).filter(name => !handled.has(name))).toEqual([])
    },
    WHOLE_PROJECT,
  )

  /** The other way round: a `handle()` on a name the boundary no longer declares is dead code. */
  it('handles no channel the boundary does not declare', () => {
    expect([...handled].filter(name => !(name in CHANNELS))).toEqual([])
  })
})
