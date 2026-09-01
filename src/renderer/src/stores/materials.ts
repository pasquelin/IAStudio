import { newMaterial, type MaterialState } from '@/engines/material/materialState'
import { createDocumentStore } from './documentStore'

/** One texture per document, with its own history — spec § 8.3. */
const store = createDocumentStore<MaterialState>(newMaterial())

export const materialStore = store
export const useMaterials = store.use
export const materialOf = store.stateOf
export const materialHistoryOf = store.historyOf
export const isMaterialDirty = store.isDirty
