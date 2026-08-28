import { createDocumentStore } from './documentStore'
import { EMPTY_GUI, type GuiState } from '@/engines/gui/guiState'

const store = createDocumentStore<GuiState>(EMPTY_GUI)

export const guiStore = store

export const useGuis = store.use

export const isGuiDirty = store.isDirty
