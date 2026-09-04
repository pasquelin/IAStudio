import type { ExternalFileImport, ExternalFileOffer } from './domain/externalFile'
import type { Channels as BaseChannels } from './channels'
import { CHANNELS as BASE_CHANNELS } from './ipcChannels'
import { EVENTS as BASE_EVENTS, type Unsubscribe } from './ipcEvents'

export type Channels = BaseChannels & {
  mediaIngestPaths: 'media:ingest-paths'
  externalFilesTake: 'external:take'
  externalFilesOffer: 'external:offer'
  externalFilesDiscard: 'external:discard'
}

export const CHANNELS: Channels = {
  ...BASE_CHANNELS,
  mediaIngestPaths: 'media:ingest-paths',
  externalFilesTake: 'external:take',
  externalFilesOffer: 'external:offer',
  externalFilesDiscard: 'external:discard',
}

export const EVENTS = { ...BASE_EVENTS, externalFiles: 'evt:external-files' }
export * from './ipcExports'
export * from './ipcDiagnostics'
export type * from './ipcEvents'

import type { StudioBridgeSettings } from './studioBridgeSettings'
import type { StudioBridgeProject } from './studioBridgeProject'
import type { StudioBridgeLibrary } from './studioBridgeLibrary'
import type { StudioBridgeCreation } from './studioBridgeCreation'
import type { StudioBridgeShell } from './studioBridgeShell'
import type { StudioBridgeAutoRig } from './studioBridgeAutoRig'

type CreationBridge = Omit<StudioBridgeCreation, 'media'> & {
  media: StudioBridgeCreation['media'] & {
    ingestPaths: (requestId: string, folder: string) => Promise<ExternalFileImport>
  }
}

type ExternalFilesBridge = {
  externalFiles: {
    take: () => Promise<ExternalFileOffer[]>
    offer: (files: readonly File[]) => Promise<ExternalFileOffer>
    discard: (requestId: string) => Promise<void>
    onOpen: (callback: () => void) => Unsubscribe
  }
}

export type StudioBridge = StudioBridgeSettings &
  StudioBridgeProject &
  StudioBridgeLibrary &
  CreationBridge &
  StudioBridgeShell &
  ExternalFilesBridge &
  StudioBridgeAutoRig
