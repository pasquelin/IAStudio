import { isRecord, readBoolean } from '@shared/guards'

/**
 * Reading an action's input, after `validatesInput` has agreed it fits the registry. The checks
 * are therefore narrowing rather than guarding, and they stay total: a handler that threw here
 * would cross the boundary as a bare `badInput` and tell the client nothing.
 */

export function textOf(input: Record<string, unknown>, key: string): string | null {
  const value = input[key]
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

export function numberOf(input: Record<string, unknown>, key: string): number | null {
  const value = input[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function boolOf(input: Record<string, unknown>, key: string): boolean {
  return readBoolean(input, key, false)
}

export function oneOf<T extends string>(
  input: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
): T | null {
  const value = input[key]
  return allowed.find(candidate => candidate === value) ?? null
}

export function recordOf(
  input: Record<string, unknown>,
  key: string,
): Record<string, unknown> | null {
  const value = input[key]
  return isRecord(value) ? value : null
}

/** A list of strings, empty rather than null: every caller treats "none given" as "none". */
export function textsOf(input: Record<string, unknown>, key: string): string[] {
  const value = input[key]
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}
