import type { FieldDescriptor } from '@shared/domain/model'

/** A text field unless the test says otherwise — the shape three suites were each declaring. */
export function field(overrides: Partial<FieldDescriptor> & { key: string }): FieldDescriptor {
  return { kind: 'text', label: overrides.key, required: false, ...overrides }
}
