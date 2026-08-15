import type { DownloadProgress, SttFailure, SttState } from '@shared/domain/dictation'
import { useDictation as useStore } from '@/stores/dictation'
import { useSettings } from '@/stores/settings'

export type Dictation = {
  state: SttState
  isListening: boolean
  /** The running hypothesis. Empty between sentences. */
  partial: string
  failure: SttFailure | null
  download: DownloadProgress | null
  /** Whether the setting allows any of this. False hides the button rather than disabling it. */
  enabled: boolean
  start: () => Promise<void>
  stop: () => Promise<void>
  cancel: () => Promise<void>
  downloadModel: () => Promise<void>
  cancelDownload: () => Promise<void>
  openPrivacySettings: () => Promise<void>
}

/**
 * A dictation session, for a component that wants one.
 *
 * The single hook the whole studio uses: the state lives in the store, the engine in another
 * process, and nothing here holds either. A component reads what it needs and calls what it
 * offers — it never owns a session.
 *
 * **The input level is deliberately absent.** It changes ten times a second, and returning it
 * here would re-render every consumer at that rate — including the ones that only show the
 * running text. `LevelMeter` subscribes to it on its own, and it is the only thing that does.
 */
export function useDictation(): Dictation {
  const state = useStore(store => store.state)
  const partial = useStore(store => store.partial)
  const failure = useStore(store => store.failure)
  const download = useStore(store => store.download)
  const enabled = useSettings(settings => settings.settings.dictation.enabled)

  // Read once rather than subscribed to: these are set when the store is created and never
  // replaced, so a subscription apiece would be six selectors run on every level update.
  const { start, stop, cancel, downloadModel, cancelDownload, openPrivacySettings } =
    useStore.getState()

  return {
    state,
    isListening: state === 'listening',
    partial,
    failure,
    download,
    enabled,
    start,
    stop,
    cancel,
    downloadModel,
    cancelDownload,
    openPrivacySettings,
  }
}
