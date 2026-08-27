// SPDX-License-Identifier: MIT

import type { Component, JsonValue } from '@shared/domain/component'

/**
 * What a system reads off a component, held to the type the descriptor declares — `null` included.
 * The registry refuses a bad value when one is WRITTEN, but a `.gltf` can come from elsewhere.
 */
export function numberOf(component: Component | null, key: string, fallback: number): number {
  const value = component?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function textOf(component: Component | null, key: string, fallback: string): string {
  const value = component?.[key]
  return typeof value === 'string' ? value : fallback
}

export function flagOf(component: Component | null, key: string, fallback: boolean): boolean {
  const value = component?.[key]
  return typeof value === 'boolean' ? value : fallback
}

/**
 * A bag of plain settings, which is what a `Script` carries beside the file it names.
 *
 * Filtered rather than trusted: a `.gltf` can come from elsewhere, and what the sandbox is handed
 * has to be JSON it can serialize — a nested object here would cross the bridge for nothing.
 */
export function settingsOf(component: Component | null, key: string): Record<string, JsonValue> {
  const value = component?.[key]
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}

  const held: Record<string, JsonValue> = {}
  for (const [name, one] of Object.entries(value)) {
    if (typeof one === 'string' || typeof one === 'number' || typeof one === 'boolean') {
      held[name] = one
    }
  }
  return held
}
