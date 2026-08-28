// SPDX-License-Identifier: MIT

import {
  DEFAULT_TEXT,
  SCREEN_PLACEMENT,
  type UiDocument,
  type UiElement,
  type UiFit,
  type UiScreen,
} from '@shared/domain/ui'
import { newUiDocument, newUiElement } from '@shared/domain/uiDocument'

/**
 * Elements for a suite to assert on, built by the reader a file goes through: a field gained by
 * the format arrives here too, rather than leaving every case describing an element of last week.
 */
const of = <T extends UiElement['type']>(type: T, id: string) => ({
  ...newUiElement(type, () => id),
  name: '',
})

export const uiPanel = (id: string, children: readonly UiElement[] = []): UiElement => ({
  ...of('panel', id),
  children,
})

export const uiText = (id: string, value = ''): UiElement => ({
  ...of('text', id),
  text: { ...DEFAULT_TEXT, value },
})

export const uiImage = (id: string, assetId: string, fit: UiFit = 'contain'): UiElement => ({
  ...of('image', id),
  image: { ...of('image', id).image, assetId, fit },
})

export const uiProgress = (id: string, value = 1): UiElement => ({
  ...of('progress', id),
  progress: { ...of('progress', id).progress, value },
})

export const uiScreen = (children: readonly UiElement[] = [], id = 'root'): UiScreen => ({
  ...of('screen', id),
  place: SCREEN_PLACEMENT,
  children,
})

export const uiDocumentOf = (root: UiScreen): UiDocument => ({
  ...newUiDocument(() => root.id),
  root,
})
