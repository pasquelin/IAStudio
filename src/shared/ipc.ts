import type { Asset } from './domain/asset'
import type { ExternalFileRequest } from './domain/externalFile'
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

type CreationBridge = Omit<StudioBridgeCreation, 'media'> & {
  media: StudioBridgeCreation['media'] & {
    ingestPaths: (requestId: string, folder: string) => Promise<Asset[]>
  }
}

type ExternalFilesBridge = {
  externalFiles: {
    take: () => Promise<ExternalFileRequest[]>
    offer: (files: readonly File[]) => Promise<ExternalFileRequest | null>
    discard: (requestId: string) => Promise<void>
    onOpen: (callback: () => void) => Unsubscribe
  }
}

export type StudioBridge = StudioBridgeSettings &
  StudioBridgeProject &
  StudioBridgeLibrary &
  CreationBridge &
  StudioBridgeShell &
  ExternalFilesBridge
