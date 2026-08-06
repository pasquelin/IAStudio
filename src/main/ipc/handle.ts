import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import type { CHANNELS, StudioBridge } from '@shared/ipc'

type ChannelName = (typeof CHANNELS)[keyof typeof CHANNELS]

/** Every method the bridge exposes, flattened: `settings.read`, `window.state`, … */
type BridgeMethods = {
  [G in keyof StudioBridge]: StudioBridge[G][keyof StudioBridge[G]]
}[keyof StudioBridge]

type Unwrapped<T> = T extends Promise<infer U> ? U : T

/**
 * Registers a handler whose signature is derived from `StudioBridge`, so the main process is
 * bound by the same contract as the preload. Without it, `CHANNELS` is a table of strings and
 * `StudioBridge` a table of functions with nothing tying them together: a handler could
 * return the wrong shape and only fail at runtime, inside a component.
 */
export function handle<M extends BridgeMethods>(
  channel: ChannelName,
  handler: (
    event: IpcMainInvokeEvent,
    ...args: M extends (...args: infer A) => unknown ? A : never
  ) => M extends (...args: never) => infer R ? Unwrapped<R> : never,
): void {
  ipcMain.handle(channel, (event, ...args) =>
    handler(event, ...(args as M extends (...args: infer A) => unknown ? A : never)),
  )
}
