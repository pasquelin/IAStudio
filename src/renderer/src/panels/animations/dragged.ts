/**
 * What a row of the animations panel carries while it is dragged, and what the band reads when
 * it is dropped.
 *
 * In a module of its own because both halves need it: a type imported back from the panel by its
 * own row closes an import cycle, which `import-cycles.test.ts` holds at zero.
 */
export type DraggedAnimation =
  { kind: 'embedded'; clip: string } | { kind: 'bundled'; path: string }

/** The drag format. Namespaced so a file dropped from the desktop is never read as one of these. */
export const ANIMATION_DRAG_TYPE = 'application/x-scenario-animation'
