// SPDX-License-Identifier: MIT

import {
  DESIGN_RESOLUTION,
  DEFAULT_INTERACTION,
  DEFAULT_PLACEMENT,
  DEFAULT_IMAGE,
  DEFAULT_PROGRESS,
  DEFAULT_STYLE,
  DEFAULT_TEXT,
  SCREEN_PLACEMENT,
  UI_VERSION,
  type UiDocument,
  type UiElement,
  type UiFit,
  type UiScreen,
} from '@shared/domain/ui'

/** What every element carries. Spread first, so a case overrides only what it is about. */
export const UI_ELEMENT_BASE = {
  name: '',
  visible: true,
  enabled: true,
  locked: false,
  place: DEFAULT_PLACEMENT,
  style: DEFAULT_STYLE,
  interaction: DEFAULT_INTERACTION,
}

export const uiPanel = (id: string, children: readonly UiElement[] = []): UiElement => ({
  ...UI_ELEMENT_BASE,
  id,
  type: 'panel',
  children,
})

export const uiText = (id: string, value = ''): UiElement => ({
  ...UI_ELEMENT_BASE,
  id,
  type: 'text',
  text: { ...DEFAULT_TEXT, value },
})

export const uiImage = (id: string, assetId: string, fit: UiFit = 'contain'): UiElement => ({
  ...UI_ELEMENT_BASE,
  id,
  type: 'image',
  image: { ...DEFAULT_IMAGE, assetId, fit },
})

export const uiProgress = (id: string, value = 1): UiElement => ({
  ...UI_ELEMENT_BASE,
  id,
  type: 'progress',
  progress: { ...DEFAULT_PROGRESS, value },
})

export const uiScreen = (children: readonly UiElement[] = [], id = 'root'): UiScreen => ({
  ...UI_ELEMENT_BASE,
  id,
  type: 'screen',
  place: SCREEN_PLACEMENT,
  children,
})

export const uiDocumentOf = (root: UiScreen): UiDocument => ({
  version: UI_VERSION,
  mode: 'screen',
  design: DESIGN_RESOLUTION,
  root,
  bindings: [],
})
