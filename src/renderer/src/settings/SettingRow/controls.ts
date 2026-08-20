import type { SettingValue } from '@shared/domain/settingsPath'
import type { SettingDescriptor } from '@shared/domain/settingsRegistry'

/**
 * What ties any control to the label above it and the help text under it. Every control takes
 * these two and they are never optional: a field whose label points nowhere is a field a screen
 * reader announces bare.
 *
 * Here rather than in `SettingRow.tsx` because every control is a file of its own now, and
 * importing it back from the parent would close an import cycle.
 */
export type Labelled = {
  id: string
  describedBy: string
  /**
   * What a script names this control by — the setting's own path, never `id`, which is a DOM
   * artefact of the `labelFor` wiring. A caller works this one out from the registry.
   */
  scId: string
}

/**
 * A control that hands its word over when the field is LEFT rather than on every keystroke —
 * hence `stored` and `onCommit` where the others take `value` and `onChange`. Written once
 * because the text field and the path field had it spelt identically.
 */
export type CommittedProps = Labelled & {
  descriptor: SettingDescriptor
  stored: SettingValue | undefined
  onCommit: (value: string) => void
}
