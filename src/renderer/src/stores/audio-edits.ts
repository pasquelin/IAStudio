import { EMPTY_AUDIO_EDIT, type AudioEditState } from '@/engines/audio/edits'
import { createDocumentStore } from './document-store'

/**
 * One edit chain per document, with its own history — the same bookkeeping every editable
 * space uses. What is stored is the chain, never the samples: see `engines/audio/edits.ts`.
 */
const store = createDocumentStore<AudioEditState>(EMPTY_AUDIO_EDIT)

export const audioEditStore = store
export const useAudioEdits = store.use
export const audioEditsOf = store.stateOf
export const audioHistoryOf = store.historyOf
