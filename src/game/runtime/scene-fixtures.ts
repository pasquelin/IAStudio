// SPDX-License-Identifier: MIT

import type { JsonValue } from '@shared/domain/component'
import { createKeptStore } from '../host/keptStore'
import type { ScenePort } from '../ports/scenePort'

export type NotedScenes = ScenePort & {
  /** Every scene asked for, in order, with the fade each one asked to be lifted over. */
  wanted: { scene: string; fade: number }[]
}

/** A scene port that goes nowhere and remembers everything — what a system is measured against. */
export function notedScenes(): NotedScenes {
  const store = createKeptStore()
  const wanted: { scene: string; fade: number }[] = []

  return {
    wanted,
    load: (scene: string, fade: number) => void wanted.push({ scene, fade }),
    keep: (key: string, value: JsonValue) => store.keep(key, value),
    kept: store.kept,
  }
}
