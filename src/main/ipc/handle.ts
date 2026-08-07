import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import type { CHANNELS, StudioBridge } from '@shared/ipc'

/**
 * Pairs each channel with the bridge method it must implement. This table is what makes the
 * boundary typed on BOTH sides: without it, `CHANNELS` is a bag of strings and
 * `StudioBridge` a bag of functions, and a handler could answer `settings:read` with a
 * window state — failing only at runtime, inside a component.
 */
type ChannelMethod = {
  [CHANNELS.settingsRead]: StudioBridge['settings']['read']
  [CHANNELS.settingsWrite]: StudioBridge['settings']['write']
  [CHANNELS.settingsSetCredentials]: StudioBridge['settings']['setCredentials']
  [CHANNELS.settingsAuthState]: StudioBridge['settings']['authState']
  [CHANNELS.settingsForgetCredentials]: StudioBridge['settings']['forgetCredentials']
  [CHANNELS.settingsOpen]: StudioBridge['settings']['open']
  [CHANNELS.settingsRunAction]: StudioBridge['settings']['runAction']
  [CHANNELS.settingsPending]: StudioBridge['settings']['setPending']

  [CHANNELS.scenarioSearchModels]: StudioBridge['scenario']['searchModels']
  [CHANNELS.scenarioModelPreviews]: StudioBridge['scenario']['modelPreviews']
  [CHANNELS.scenarioDescribeModel]: StudioBridge['scenario']['describeModel']
  [CHANNELS.scenarioGenerate]: StudioBridge['scenario']['generate']
  [CHANNELS.scenarioCancelJob]: StudioBridge['scenario']['cancelJob']
  [CHANNELS.scenarioListJobs]: StudioBridge['scenario']['listJobs']

  [CHANNELS.projectCreate]: StudioBridge['project']['create']
  [CHANNELS.projectOpen]: StudioBridge['project']['open']
  [CHANNELS.projectCurrent]: StudioBridge['project']['current']
  [CHANNELS.dialogPickPath]: StudioBridge['dialog']['pickPath']

  [CHANNELS.documentRead]: StudioBridge['documents']['read']
  [CHANNELS.documentWrite]: StudioBridge['documents']['write']
  [CHANNELS.documentRemove]: StudioBridge['documents']['remove']

  [CHANNELS.assetsSearch]: StudioBridge['assets']['search']
  [CHANNELS.assetsPeaks]: StudioBridge['assets']['peaks']
  [CHANNELS.assetsReveal]: StudioBridge['assets']['reveal']
  [CHANNELS.assetsSaveAudio]: StudioBridge['assets']['saveAudio']

  [CHANNELS.mediaIngest]: StudioBridge['media']['ingest']
  [CHANNELS.mediaCancel]: StudioBridge['media']['cancel']
  [CHANNELS.mediaAvailable]: StudioBridge['media']['capabilities']

  [CHANNELS.windowToggleFullScreen]: StudioBridge['window']['toggleFullScreen']
  [CHANNELS.windowState]: StudioBridge['window']['state']
  [CHANNELS.windowWorkspace]: StudioBridge['window']['setWorkspace']
}

type Resolved<T> = T extends Promise<infer U> ? U : T

/**
 * Registers a handler whose arguments and return type are derived from the channel itself.
 * Answering with the wrong shape, or forgetting an argument, is a compile error.
 *
 * The handler may be synchronous or asynchronous: most channels reach the network or the
 * disk, and forcing a synchronous return would make the helper unusable for them.
 */
export function handle<C extends keyof ChannelMethod>(
  channel: C,
  handler: (
    event: IpcMainInvokeEvent,
    ...args: Parameters<ChannelMethod[C]>
  ) => Resolved<ReturnType<ChannelMethod[C]>> | Promise<Resolved<ReturnType<ChannelMethod[C]>>>,
): void {
  ipcMain.handle(channel, (event, ...args) =>
    handler(event, ...(args as Parameters<ChannelMethod[C]>)),
  )
}
