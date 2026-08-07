/**
 * `ipcMain` in a bottle, for handler tests — four of them had grown their own copy, so any
 * change to `handle()` meant four edits.
 *
 * The registry is a module singleton because `vi.mock` factories are hoisted above imports: a
 * const declared in the test file would still be in its temporal dead zone when the factory
 * runs. The test mocks with `async () => (await import(…)).mockElectron()`, whose dynamic
 * import resolves at call time, and reads back the same registry through its own import.
 */
type Invoke = (...args: unknown[]) => unknown

const registered = new Map<string, Invoke>()

export function mockElectron(): {
  ipcMain: { handle: (channel: string, handler: Invoke) => void }
} {
  return { ipcMain: { handle: (channel, handler) => void registered.set(channel, handler) } }
}

/** Calls the registered handler, with the event argument every handler ignores. */
export function invoke(channel: string, ...args: unknown[]): unknown {
  const handler = registered.get(channel)
  if (!handler) throw new Error(`no handler registered for ${channel}`)
  return handler({}, ...args)
}

export function resetHandlers(): void {
  registered.clear()
}
