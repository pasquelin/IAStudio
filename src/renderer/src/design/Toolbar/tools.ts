/**
 * What a toolbar is handed: one entry per button, and the modes a button may offer.
 *
 * Here rather than in `Toolbar.tsx` because both halves of the bar need it — the bar itself and
 * the `ToolbarTool` that draws one entry — and importing it back from the parent would close an
 * import cycle. Five spaces declare their tools against these types too.
 */
export type ToolMode = {
  id: string
  /** i18n key of the label — never the displayed text. */
  labelKey: string
  /**
   * i18n key of the one-line tooltip. Required: a mode's label is on screen inside its row, so
   * the tooltip is the only thing that can say more than the label already does.
   */
  descriptionKey: string
  icon: string
  shortcut?: string
  /** Declared but not wired yet: shown greyed, so the bar never hides what is coming. */
  disabled?: boolean
}

export type ToolbarItem = {
  id: string
  /** i18n key of the label — never the displayed text. */
  labelKey: string
  /** i18n key of the one-line tooltip. Absent tips the label, which is better than nothing. */
  descriptionKey?: string
  icon: string
  shortcut?: string
  disabled?: boolean
  /** A toggle that is on. Distinct from `activeTool`, the one armed tool, and drawn alike. */
  pressed?: boolean
  /**
   * Acts rather than arms — Duplicate, Add, the model edits. It gets no `aria-pressed`: a button
   * for ever announcing "toggle, not pressed" describes a state it does not have, which is the
   * very reason the montage bar puts its two action buttons in `extras` instead of here.
   */
  acts?: true
  /** Two or more open a flyout on hover; one or none makes the button act directly. */
  modes?: readonly ToolMode[]
  activeMode?: string
  /** Draws a divider before this tool, so the bar reads as groups and not a run of icons. */
  separatorBefore?: boolean
}
