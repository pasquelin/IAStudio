import type { Signature } from './shortcut'

/**
 * Which surface a command belongs to. Two spaces legitimately want the same key — `Delete`
 * removes a node in the scene and a clip on the timeline — and only one of them is listening
 * at a time. Without a scope the second binding would be unreachable rather than contextual.
 *
 * `global` is the application itself: reachable from any window, and what the native menu
 * offers. Its bindings are the only ones that may clash with everything else, so they are the
 * only ones a conflict check treats as competing with every scope.
 */
export type CommandScope = 'global' | 'scene' | 'sequence' | 'canvas'

export type CommandId =
  | 'project.new'
  | 'project.open'
  | 'document.save'
  | 'layout.reset'
  | 'app.settings'
  | 'window.fullScreen'
  | 'scene.select'
  | 'scene.translate'
  | 'scene.rotate'
  | 'scene.scale'
  | 'scene.frame'
  | 'scene.snap'
  | 'scene.space'
  | 'scene.delete'
  | 'scene.undo'
  | 'scene.redo'
  | 'sequence.playPause'
  | 'sequence.split'
  | 'sequence.delete'
  | 'sequence.zoomIn'
  | 'sequence.zoomOut'
  | 'sequence.fit'
  | 'sequence.start'
  | 'sequence.end'
  | 'sequence.undo'
  | 'sequence.redo'
  | 'canvas.zoomIn'
  | 'canvas.zoomOut'
  | 'canvas.zoomFit'
  | 'canvas.zoomActual'
  | 'canvas.rulers'
  | 'canvas.guides'
  | 'canvas.clearGuides'
  | 'canvas.deselect'
  | 'canvas.maskFromSelection'
  | 'canvas.regenerate'
  | 'canvas.cutout'
  | 'canvas.enlarge'
  | 'canvas.vectorize'
  | 'canvas.extend'
  | 'canvas.export'
  | 'canvas.snap'
  | 'canvas.undo'
  | 'canvas.redo'

/**
 * What a command is: where it applies, what it is called, what it does in plain words, and the
 * key it ships with.
 *
 * One table, read by three surfaces that used to disagree: the native menu, which wrote its own
 * accelerators by hand; the keyboard, which read a table of its own; and the settings screen,
 * which had nothing to read at all. A command remapped in one place now moves in all three.
 */
export type CommandDescriptor = {
  id: CommandId
  scope: CommandScope
  titleKey: string
  /** Never optional, for the same reason a setting's help is not: see `SETTING_REGISTRY`. */
  helpKey: string
  /**
   * What it ships with. `null` is legitimate — a command listed, searchable, and waiting for a
   * key someone chooses to give it.
   */
  defaultBinding: Signature | null
}

function command(descriptor: CommandDescriptor): CommandDescriptor {
  return descriptor
}

export const COMMAND_REGISTRY: readonly CommandDescriptor[] = [
  command({
    id: 'project.new',
    scope: 'global',
    titleKey: 'commands.projectNew.title',
    helpKey: 'commands.projectNew.help',
    defaultBinding: 'Meta+KeyN',
  }),
  command({
    id: 'project.open',
    scope: 'global',
    titleKey: 'commands.projectOpen.title',
    helpKey: 'commands.projectOpen.help',
    defaultBinding: 'Meta+KeyO',
  }),
  command({
    id: 'document.save',
    scope: 'global',
    titleKey: 'commands.documentSave.title',
    helpKey: 'commands.documentSave.help',
    defaultBinding: 'Meta+KeyS',
  }),
  command({
    id: 'layout.reset',
    scope: 'global',
    titleKey: 'commands.layoutReset.title',
    helpKey: 'commands.layoutReset.help',
    defaultBinding: null,
  }),
  command({
    id: 'app.settings',
    scope: 'global',
    titleKey: 'commands.appSettings.title',
    helpKey: 'commands.appSettings.help',
    defaultBinding: 'Meta+Comma',
  }),
  command({
    id: 'window.fullScreen',
    scope: 'global',
    titleKey: 'commands.windowFullScreen.title',
    helpKey: 'commands.windowFullScreen.help',
    defaultBinding: 'Ctrl+Meta+KeyF',
  }),

  // `KeyV` as in every editor that has a pointer tool. Not `KeyQ` or `KeyW`, which fly the
  // camera: `useShortcuts` reads both tables on the same keydown, so one key would do both.
  command({
    id: 'scene.select',
    scope: 'scene',
    titleKey: 'commands.sceneSelect.title',
    helpKey: 'commands.sceneSelect.help',
    defaultBinding: 'KeyV',
  }),
  command({
    id: 'scene.translate',
    scope: 'scene',
    titleKey: 'commands.sceneTranslate.title',
    helpKey: 'commands.sceneTranslate.help',
    defaultBinding: 'KeyG',
  }),
  command({
    id: 'scene.rotate',
    scope: 'scene',
    titleKey: 'commands.sceneRotate.title',
    helpKey: 'commands.sceneRotate.help',
    defaultBinding: 'KeyR',
  }),
  command({
    id: 'scene.scale',
    scope: 'scene',
    titleKey: 'commands.sceneScale.title',
    helpKey: 'commands.sceneScale.help',
    defaultBinding: 'KeyS',
  }),
  command({
    id: 'scene.frame',
    scope: 'scene',
    titleKey: 'commands.sceneFrame.title',
    helpKey: 'commands.sceneFrame.help',
    defaultBinding: 'KeyF',
  }),
  // `KeyM` and `KeyL` as in magnet and local. Neither flies the camera, which rules out most of
  // the left hand: `useShortcuts` reads both tables on the same keydown.
  command({
    id: 'scene.snap',
    scope: 'scene',
    titleKey: 'commands.sceneSnap.title',
    helpKey: 'commands.sceneSnap.help',
    defaultBinding: 'KeyM',
  }),
  command({
    id: 'scene.space',
    scope: 'scene',
    titleKey: 'commands.sceneSpace.title',
    helpKey: 'commands.sceneSpace.help',
    defaultBinding: 'KeyL',
  }),
  command({
    id: 'scene.delete',
    scope: 'scene',
    titleKey: 'commands.sceneDelete.title',
    helpKey: 'commands.sceneDelete.help',
    defaultBinding: 'Delete',
  }),
  command({
    id: 'scene.undo',
    scope: 'scene',
    titleKey: 'commands.undo.title',
    helpKey: 'commands.undo.help',
    defaultBinding: 'Meta+KeyZ',
  }),
  command({
    id: 'scene.redo',
    scope: 'scene',
    titleKey: 'commands.redo.title',
    helpKey: 'commands.redo.help',
    defaultBinding: 'Shift+Meta+KeyZ',
  }),

  // Same keys as the scene where the gesture is the same. They only ever reach the surface
  // that is listening, which is what `CommandScope` is for.
  command({
    id: 'sequence.playPause',
    scope: 'sequence',
    titleKey: 'commands.sequencePlayPause.title',
    helpKey: 'commands.sequencePlayPause.help',
    defaultBinding: 'Space',
  }),
  command({
    id: 'sequence.split',
    scope: 'sequence',
    titleKey: 'commands.sequenceSplit.title',
    helpKey: 'commands.sequenceSplit.help',
    defaultBinding: 'KeyS',
  }),
  command({
    id: 'sequence.delete',
    scope: 'sequence',
    titleKey: 'commands.sequenceDelete.title',
    helpKey: 'commands.sequenceDelete.help',
    defaultBinding: 'Delete',
  }),
  command({
    id: 'sequence.zoomIn',
    scope: 'sequence',
    titleKey: 'commands.sequenceZoomIn.title',
    helpKey: 'commands.sequenceZoomIn.help',
    defaultBinding: 'Meta+Equal',
  }),
  command({
    id: 'sequence.zoomOut',
    scope: 'sequence',
    titleKey: 'commands.sequenceZoomOut.title',
    helpKey: 'commands.sequenceZoomOut.help',
    defaultBinding: 'Meta+Minus',
  }),
  command({
    id: 'sequence.fit',
    scope: 'sequence',
    titleKey: 'commands.sequenceFit.title',
    helpKey: 'commands.sequenceFit.help',
    defaultBinding: 'Shift+KeyZ',
  }),
  command({
    id: 'sequence.start',
    scope: 'sequence',
    titleKey: 'commands.sequenceStart.title',
    helpKey: 'commands.sequenceStart.help',
    defaultBinding: 'Home',
  }),
  command({
    id: 'sequence.end',
    scope: 'sequence',
    titleKey: 'commands.sequenceEnd.title',
    helpKey: 'commands.sequenceEnd.help',
    defaultBinding: 'End',
  }),
  command({
    id: 'sequence.undo',
    scope: 'sequence',
    titleKey: 'commands.undo.title',
    helpKey: 'commands.undo.help',
    defaultBinding: 'Meta+KeyZ',
  }),
  command({
    id: 'sequence.redo',
    scope: 'sequence',
    titleKey: 'commands.redo.title',
    helpKey: 'commands.redo.help',
    defaultBinding: 'Shift+Meta+KeyZ',
  }),

  // Navigating an image. Same keys as the timeline's own zoom, and for the same reason they may
  // be: only the surface in front is listening.
  command({
    id: 'canvas.zoomIn',
    scope: 'canvas',
    titleKey: 'commands.canvasZoomIn.title',
    helpKey: 'commands.canvasZoomIn.help',
    defaultBinding: 'Meta+Equal',
  }),
  command({
    id: 'canvas.zoomOut',
    scope: 'canvas',
    titleKey: 'commands.canvasZoomOut.title',
    helpKey: 'commands.canvasZoomOut.help',
    defaultBinding: 'Meta+Minus',
  }),
  command({
    id: 'canvas.zoomFit',
    scope: 'canvas',
    titleKey: 'commands.canvasZoomFit.title',
    helpKey: 'commands.canvasZoomFit.help',
    defaultBinding: 'Meta+Digit0',
  }),
  command({
    id: 'canvas.zoomActual',
    scope: 'canvas',
    titleKey: 'commands.canvasZoomActual.title',
    helpKey: 'commands.canvasZoomActual.help',
    defaultBinding: 'Meta+Digit1',
  }),
  command({
    id: 'canvas.rulers',
    scope: 'canvas',
    titleKey: 'commands.canvasRulers.title',
    helpKey: 'commands.canvasRulers.help',
    defaultBinding: 'Meta+KeyR',
  }),
  command({
    id: 'canvas.guides',
    scope: 'canvas',
    titleKey: 'commands.canvasGuides.title',
    helpKey: 'commands.canvasGuides.help',
    defaultBinding: 'Meta+Semicolon',
  }),
  command({
    id: 'canvas.clearGuides',
    scope: 'canvas',
    titleKey: 'commands.canvasClearGuides.title',
    helpKey: 'commands.canvasClearGuides.help',
    defaultBinding: null,
  }),
  command({
    id: 'canvas.deselect',
    scope: 'canvas',
    titleKey: 'commands.canvasDeselect.title',
    helpKey: 'commands.canvasDeselect.help',
    defaultBinding: 'Meta+KeyD',
  }),
  command({
    id: 'canvas.maskFromSelection',
    scope: 'canvas',
    titleKey: 'commands.canvasMaskFromSelection.title',
    helpKey: 'commands.canvasMaskFromSelection.help',
    defaultBinding: null,
  }),
  command({
    id: 'canvas.regenerate',
    scope: 'canvas',
    titleKey: 'commands.canvasRegenerate.title',
    helpKey: 'commands.canvasRegenerate.help',
    defaultBinding: null,
  }),
  command({
    id: 'canvas.cutout',
    scope: 'canvas',
    titleKey: 'commands.canvasCutout.title',
    helpKey: 'commands.canvasCutout.help',
    defaultBinding: null,
  }),
  command({
    id: 'canvas.enlarge',
    scope: 'canvas',
    titleKey: 'commands.canvasEnlarge.title',
    helpKey: 'commands.canvasEnlarge.help',
    defaultBinding: null,
  }),
  command({
    id: 'canvas.vectorize',
    scope: 'canvas',
    titleKey: 'commands.canvasVectorize.title',
    helpKey: 'commands.canvasVectorize.help',
    defaultBinding: null,
  }),
  command({
    id: 'canvas.extend',
    scope: 'canvas',
    titleKey: 'commands.canvasExtend.title',
    helpKey: 'commands.canvasExtend.help',
    defaultBinding: null,
  }),
  command({
    id: 'canvas.export',
    scope: 'canvas',
    titleKey: 'commands.canvasExport.title',
    helpKey: 'commands.canvasExport.help',
    defaultBinding: 'Shift+Meta+KeyE',
  }),
  command({
    id: 'canvas.snap',
    scope: 'canvas',
    titleKey: 'commands.canvasSnap.title',
    helpKey: 'commands.canvasSnap.help',
    defaultBinding: 'Shift+Meta+Semicolon',
  }),
  command({
    id: 'canvas.undo',
    scope: 'canvas',
    titleKey: 'commands.undo.title',
    helpKey: 'commands.undo.help',
    defaultBinding: 'Meta+KeyZ',
  }),
  command({
    id: 'canvas.redo',
    scope: 'canvas',
    titleKey: 'commands.redo.title',
    helpKey: 'commands.redo.help',
    defaultBinding: 'Shift+Meta+KeyZ',
  }),
]

export const COMMAND_SCOPES: readonly CommandScope[] = ['global', 'scene', 'sequence', 'canvas']

export function commandDescriptor(id: CommandId): CommandDescriptor | null {
  return COMMAND_REGISTRY.find(descriptor => descriptor.id === id) ?? null
}

export function commandsIn(scope: CommandScope): readonly CommandDescriptor[] {
  return COMMAND_REGISTRY.filter(descriptor => descriptor.scope === scope)
}

/** What the user remapped. Only the commands they actually changed appear here. */
export type BindingOverrides = Partial<Record<CommandId, Signature>>

/**
 * The key a command answers to. Resolved on demand rather than kept as a full table: a command
 * added by a new version arrives with its own default and needs no migration, and a remap of a
 * command since removed is ignored instead of lingering.
 */
export function bindingOf(id: CommandId, overrides: BindingOverrides): Signature | null {
  return overrides[id] ?? commandDescriptor(id)?.defaultBinding ?? null
}

/**
 * The command a signature fires on one surface. Scoped, because the same key means different
 * things on the timeline and in the scene, and only one of the two is ever listening.
 *
 * `global` is deliberately excluded: those are the native menu's accelerators, and Electron
 * fires them itself — matching them here too would run the command twice.
 */
export function commandFor(
  signature: Signature,
  scope: CommandScope,
  overrides: BindingOverrides,
): CommandId | null {
  const found = COMMAND_REGISTRY.find(
    descriptor => descriptor.scope === scope && bindingOf(descriptor.id, overrides) === signature,
  )
  return found?.id ?? null
}

/**
 * Commands sharing a signature with another one they could both answer to — what the shortcuts
 * screen shows in red. Across two surfaces a shared key is the design, not a clash; against a
 * `global` one it always is, because the menu fires those wherever the focus sits.
 */
export function conflicts(overrides: BindingOverrides): readonly CommandId[] {
  // Grouped by signature in one pass rather than compared pairwise: the shortcuts screen
  // recomputes this on every keystroke of a capture, and the pairwise form resolved each
  // binding twice per pair.
  const bySignature = new Map<Signature, CommandDescriptor[]>()

  for (const descriptor of COMMAND_REGISTRY) {
    const signature = bindingOf(descriptor.id, overrides)
    // A command bound to nothing cannot clash with anything.
    if (signature === null) continue
    bySignature.set(signature, [...(bySignature.get(signature) ?? []), descriptor])
  }

  const clashing: CommandId[] = []

  for (const sharing of bySignature.values()) {
    if (sharing.length < 2) continue

    for (const descriptor of sharing) {
      const contested = sharing.some(
        other =>
          other.id !== descriptor.id &&
          (other.scope === descriptor.scope ||
            other.scope === 'global' ||
            descriptor.scope === 'global'),
      )
      if (contested) clashing.push(descriptor.id)
    }
  }

  return clashing
}
