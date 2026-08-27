// SPDX-License-Identifier: MIT

import type { Component } from '@shared/domain/component'

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
