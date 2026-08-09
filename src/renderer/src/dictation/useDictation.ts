import { useEffect } from 'react'
import type { DownloadProgress, SttFailure, SttState } from '@shared/domain/dictation'
import { useDictation as useStore } from '@/stores/dictation'
import { useSettings } from '@/stores/settings'

export type DictationOptions = {
  /**
   * Where a settled sentence goes. Absent — the usual case — puts it at the caret of whatever
   * field has the focus, which is what makes dictation work everywhere.
   */
  onFinal?: (text: string) => void
}

export type Dictation = {
  state: SttState
  isListening: boolean
  /** The running hypothesis. Empty between sentences. */
  partial: string
  /** Input level, 0 to 1. */
  level: number
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
 */
export function useDictation({ onFinal }: DictationOptions = {}): Dictation {
  const state = useStore(store => store.state)
  const partial = useStore(store => store.partial)
  const level = useStore(store => store.level)
  const failure = useStore(store => store.failure)
  const download = useStore(store => store.download)
  const enabled = useSettings(settings => settings.settings.dictation.enabled)

  // Claimed for as long as this component is mounted, and given back on the way out: two fields
  // asking at once is not something a single microphone can serve, and the last to ask is the
  // one the user is looking at.
  useEffect(() => {
    if (!onFinal) return

    useStore.setState({ onFinal })
    return () => {
      if (useStore.getState().onFinal === onFinal) useStore.setState({ onFinal: null })
    }
  }, [onFinal])

  return {
    state,
    isListening: state === 'listening',
    partial,
    level,
    failure,
    download,
    enabled,
    start: useStore(store => store.start),
    stop: useStore(store => store.stop),
    cancel: useStore(store => store.cancel),
    downloadModel: useStore(store => store.downloadModel),
    cancelDownload: useStore(store => store.cancelDownload),
    openPrivacySettings: useStore(store => store.openPrivacySettings),
  }
}
