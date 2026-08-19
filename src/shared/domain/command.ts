import type { DisplayMode } from './scene'
import type { Signature } from './shortcut'
import { HOME_SURFACE, type ToolSurface } from './tool'
import type { WorkspaceId } from './workspace'

/**
 * Which surface a command belongs to. Two spaces legitimately want the same key — `Delete`
 * removes a node in the scene and a clip on the timeline — and only one of them is listening
 * at a time. Without a scope the second binding would be unreachable rather than contextual.
 *
 * `global` is the application itself: reachable from any window, and what the native menu
 * offers. Its bindings are the only ones that may clash with everything else, so they are the
 * only ones a conflict check treats as competing with every scope.
 */
export type CommandScope =
  | 'global'
  | 'spaces'
  /**
   * The project folder. Its own scope, and not `global`, for the reason the whole undo stack
   * lives in the main process: a file gesture belongs to no document, so ⌘Z in the canvas must
   * not reach it and ⌘Z here must not reach the canvas. `commandFor` filters by scope, and the
   * panel arms this one only while the focus is inside it.
   */
  | 'explorer'
  | 'scene'
  | 'sequence'
  | 'canvas'
  | 'skybox'
  | 'audio'
  | 'texture'

export type CommandId =
  | 'project.new'
  | 'project.open'
  | 'document.save'
  | 'document.saveAs'
  | 'layout.reset'
  | 'app.settings'
  | 'app.assistant'
  | 'app.dictate'
  | 'window.fullScreen'
  | 'spaces.moveLeft'
  | 'spaces.moveRight'
  | 'explorer.newFolder'
  | 'explorer.duplicate'
  | 'explorer.cut'
  | 'explorer.copy'
  | 'explorer.paste'
  | 'explorer.trash'
  | 'explorer.undo'
  | 'explorer.redo'
  | 'scene.select'
  | 'scene.translate'
  | 'scene.rotate'
  | 'scene.scale'
  | 'scene.frame'
  | 'scene.add'
  | 'scene.group'
  | 'scene.duplicate'
  | 'scene.copy'
  | 'scene.cut'
  | 'scene.paste'
  | 'scene.snap'
  | 'scene.space'
  | 'scene.projection'
  | 'scene.quad'
  | 'scene.quadEdges'
  | 'scene.display'
  | 'scene.skeletons'
  | 'scene.poseMode'
  | 'scene.delete'
  | 'scene.undo'
  | 'scene.redo'
  | 'sequence.playPause'
  | 'sequence.export'
  | 'sequence.exportCut'
  | 'sequence.exportBundle'
  | 'sequence.exportEdl'
  | 'montage.import'
  | 'sequence.mirror'
  | 'sequence.split'
  | 'sequence.delete'
  | 'sequence.unlink'
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
  | 'canvas.cropApply'
  | 'canvas.cropCancel'
  | 'canvas.maskFromSelection'
  | 'canvas.regenerate'
  | 'canvas.cutout'
  | 'canvas.enlarge'
  | 'canvas.vectorize'
  | 'canvas.extend'
  | 'canvas.export'
  | 'canvas.exportLayered'
  | 'canvas.mergeDown'
  | 'canvas.flatten'
  | 'canvas.flipHorizontal'
  | 'canvas.flipVertical'
  | 'canvas.rotateCw'
  | 'canvas.rotateCcw'
  | 'canvas.snap'
  | 'canvas.toolMove'
  | 'canvas.toolHand'
  | 'canvas.toolScale'
  | 'canvas.toolCrop'
  | 'canvas.toolSelectRectangle'
  | 'canvas.toolSelectEllipse'
  | 'canvas.toolSelectLasso'
  | 'canvas.toolShapeRectangle'
  | 'canvas.toolShapeLine'
  | 'canvas.toolShapeArrow'
  | 'canvas.toolShapeEllipse'
  | 'canvas.toolShapePolygon'
  | 'canvas.toolShapeStar'
  | 'canvas.toolBrush'
  | 'canvas.toolPencil'
  | 'canvas.toolText'
  | 'canvas.toolEraser'
  | 'canvas.toolEraserSelection'
  | 'canvas.toolFill'
  | 'canvas.toolPicker'
  | 'canvas.brushSmaller'
  | 'canvas.brushLarger'
  | 'canvas.undo'
  | 'canvas.redo'
  | 'skybox.view'
  | 'skybox.probes'
  | 'skybox.undo'
  | 'skybox.redo'
  | 'audio.undo'
  | 'audio.redo'
  | 'texture.undo'
  | 'texture.redo'

/**
 * A menu row that draws a state: a command that toggles, or one mode of a command that cycles.
 *
 * The renderer publishes the ones that are ON and the main process ticks exactly those. A string
 * rather than a structure because it crosses the bridge and is only ever compared.
 *
 * BOTH halves are typed, and the second one is the point: `${CommandId}:${string}` would have
 * accepted `scene.display:mattcap` without a word, and a radio row silently never ticked is the
 * hardest kind of wrong to see. The union of modes widens the day a second command cycles
 * through something — which is the moment to look at this line, not a cost to avoid.
 *
 * Kept out of the row itself: whether a scene is drawn in wireframe is not a fact of the command
 * registry, it is a fact of the document in front, which only the renderer holds.
 */
export type MenuCheck = CommandId | `scene.display:${DisplayMode}`

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
  /**
   * Held rather than tapped: it reports pressed and released instead of firing once.
   *
   * A held command is heard by the window even when its scope is `global`, which is the one
   * exception to the rule below — a native accelerator has no release to report, so the menu
   * cannot serve one, and no menu row is declared for it.
   *
   * It is also heard while the focus sits in a text field, where every other shortcut is
   * silent: dictation exists to write into the field one is already in. A held command
   * therefore has to carry a modifier, or it would swallow a letter.
   */
  held?: boolean
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
    id: 'document.saveAs',
    scope: 'global',
    titleKey: 'commands.documentSaveAs.title',
    helpKey: 'commands.documentSaveAs.help',
    defaultBinding: 'Shift+Meta+KeyS',
  }),
  // `global` rather than `sequence`, unlike the two exports it mirrors: an import has no montage
  // in front to belong to — it is what MAKES one.
  command({
    id: 'montage.import',
    scope: 'global',
    titleKey: 'commands.montageImport.title',
    helpKey: 'commands.montageImport.help',
    defaultBinding: null,
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
    id: 'app.assistant',
    scope: 'global',
    titleKey: 'commands.appAssistant.title',
    helpKey: 'commands.appAssistant.help',
    // Free in the registry, and checked: ⌘K was taken by nothing, and the bare `K` the image
    // space binds to its scale tool is a different signature entirely.
    defaultBinding: 'Meta+KeyK',
  }),
  command({
    id: 'app.dictate',
    scope: 'global',
    titleKey: 'commands.appDictate.title',
    helpKey: 'commands.appDictate.help',
    defaultBinding: 'Alt+KeyD',
    held: true,
  }),
  command({
    id: 'window.fullScreen',
    scope: 'global',
    titleKey: 'commands.windowFullScreen.title',
    helpKey: 'commands.windowFullScreen.help',
    defaultBinding: 'Ctrl+Meta+KeyF',
  }),

  // Alt and not the bare arrows: those belong to whoever walks the bar, and taking them would
  // trade one gesture for another. Its own scope because it is heard by the focused pill alone,
  // where a `global` binding would fire from anywhere and move a space nobody was pointing at.
  command({
    id: 'spaces.moveLeft',
    scope: 'spaces',
    titleKey: 'commands.spacesMoveLeft.title',
    helpKey: 'commands.spacesMoveLeft.help',
    defaultBinding: 'Alt+ArrowLeft',
  }),
  command({
    id: 'spaces.moveRight',
    scope: 'spaces',
    titleKey: 'commands.spacesMoveRight.title',
    helpKey: 'commands.spacesMoveRight.help',
    defaultBinding: 'Alt+ArrowRight',
  }),

  /**
   * The file browser's own eight. The keys are the ones every file browser on the platform
   * answers to, and none of them clashes with a `global` one — which is the only clash that
   * would matter, since the native menu fires those wherever the focus sits.
   *
   * ⌘⌫ rather than ⌫ alone: this is the one gesture here that cannot be undone, and a bare
   * delete key is too close to what a hand does while reading a list.
   */
  command({
    id: 'explorer.newFolder',
    scope: 'explorer',
    titleKey: 'commands.explorerNewFolder.title',
    helpKey: 'commands.explorerNewFolder.help',
    defaultBinding: 'Shift+Meta+KeyN',
  }),
  command({
    id: 'explorer.duplicate',
    scope: 'explorer',
    titleKey: 'commands.explorerDuplicate.title',
    helpKey: 'commands.explorerDuplicate.help',
    defaultBinding: 'Meta+KeyD',
  }),
  command({
    id: 'explorer.cut',
    scope: 'explorer',
    titleKey: 'commands.explorerCut.title',
    helpKey: 'commands.explorerCut.help',
    defaultBinding: 'Meta+KeyX',
  }),
  command({
    id: 'explorer.copy',
    scope: 'explorer',
    titleKey: 'commands.explorerCopy.title',
    helpKey: 'commands.explorerCopy.help',
    defaultBinding: 'Meta+KeyC',
  }),
  command({
    id: 'explorer.paste',
    scope: 'explorer',
    titleKey: 'commands.explorerPaste.title',
    helpKey: 'commands.explorerPaste.help',
    defaultBinding: 'Meta+KeyV',
  }),
  command({
    id: 'explorer.trash',
    scope: 'explorer',
    titleKey: 'commands.explorerTrash.title',
    helpKey: 'commands.explorerTrash.help',
    defaultBinding: 'Meta+Backspace',
  }),
  command({
    id: 'explorer.undo',
    scope: 'explorer',
    titleKey: 'commands.explorerUndo.title',
    helpKey: 'commands.explorerUndo.help',
    defaultBinding: 'Meta+KeyZ',
  }),
  command({
    id: 'explorer.redo',
    scope: 'explorer',
    titleKey: 'commands.explorerRedo.title',
    helpKey: 'commands.explorerRedo.help',
    defaultBinding: 'Shift+Meta+KeyZ',
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
    id: 'scene.projection',
    scope: 'scene',
    titleKey: 'commands.sceneProjection.title',
    helpKey: 'commands.sceneProjection.help',
    defaultBinding: 'KeyO',
  }),
  // `Q` as in Blender's own quad view, but shifted: bare `Q` is flight's "down", and the one
  // overlap this scope tolerates is already spent on `KeyS` — see `shortcut.test.ts`.
  command({
    id: 'scene.quad',
    scope: 'scene',
    titleKey: 'commands.sceneQuad.title',
    helpKey: 'commands.sceneQuad.help',
    defaultBinding: 'Shift+KeyQ',
  }),
  // `Shift+W` for wires: bare `W` is flight's "forward", and this reads the same edges the
  // wireframe draws, so it sits beside it rather than beside the layout.
  command({
    id: 'scene.quadEdges',
    scope: 'scene',
    titleKey: 'commands.sceneQuadEdges.title',
    helpKey: 'commands.sceneQuadEdges.help',
    defaultBinding: 'Shift+KeyW',
  }),
  // `Z` as in Blender, where it is the key that changes what the viewport draws.
  command({
    id: 'scene.display',
    scope: 'scene',
    titleKey: 'commands.sceneDisplay.title',
    helpKey: 'commands.sceneDisplay.help',
    defaultBinding: 'KeyZ',
  }),
  // `KeyB` as in bones. Nothing in the scene scope claims it, and the fly keys are all on the
  // left hand — see the note above `scene.snap`.
  command({
    id: 'scene.skeletons',
    scope: 'scene',
    titleKey: 'commands.sceneSkeletons.title',
    helpKey: 'commands.sceneSkeletons.help',
    defaultBinding: 'KeyB',
  }),
  // `KeyP` as in pose, and next to `KeyB` for bones — the two go together at the hand.
  command({
    id: 'scene.poseMode',
    scope: 'scene',
    titleKey: 'commands.scenePoseMode.title',
    helpKey: 'commands.scenePoseMode.help',
    defaultBinding: 'KeyP',
  }),
  // `⇧A` as in Blender, whose Add menu this is. It opens rows rather than doing anything, which
  // is why it carries no verb of its own.
  command({
    id: 'scene.add',
    scope: 'scene',
    titleKey: 'commands.sceneAdd.title',
    helpKey: 'commands.sceneAdd.help',
    defaultBinding: 'Shift+KeyA',
  }),
  // `⌘G` as in every editor that groups: the key is taken by nothing else in this scope.
  command({
    id: 'scene.group',
    scope: 'scene',
    titleKey: 'commands.sceneGroup.title',
    helpKey: 'commands.sceneGroup.help',
    defaultBinding: 'Meta+KeyG',
  }),
  // The four gestures every editor shares, on the keys every editor uses. `role: 'editMenu'`
  // carries the same three for text fields; a scene tab is not one, and `isTyping` keeps them
  // apart when it is.
  command({
    id: 'scene.duplicate',
    scope: 'scene',
    titleKey: 'commands.sceneDuplicate.title',
    helpKey: 'commands.sceneDuplicate.help',
    defaultBinding: 'Meta+KeyD',
  }),
  command({
    id: 'scene.copy',
    scope: 'scene',
    titleKey: 'commands.sceneCopy.title',
    helpKey: 'commands.sceneCopy.help',
    defaultBinding: 'Meta+KeyC',
  }),
  command({
    id: 'scene.cut',
    scope: 'scene',
    titleKey: 'commands.sceneCut.title',
    helpKey: 'commands.sceneCut.help',
    defaultBinding: 'Meta+KeyX',
  }),
  command({
    id: 'scene.paste',
    scope: 'scene',
    titleKey: 'commands.scenePaste.title',
    helpKey: 'commands.scenePaste.help',
    defaultBinding: 'Meta+KeyV',
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
    id: 'sequence.export',
    scope: 'sequence',
    titleKey: 'commands.sequenceExport.title',
    helpKey: 'commands.sequenceExport.help',
    // NOT ⌘M, which Premiere uses and macOS has already spoken for: `roleItem('minimize')` puts
    // it on the Window menu, and two menu rows carrying one accelerator is a key nobody owns.
    // Shift+⌘E is taken too, so this ships without one until someone chooses it — legitimate,
    // and better than a row that quietly steals Minimise.
    defaultBinding: null,
  }),
  // Beside the one above rather than a mode of it: one writes a film, the other writes the EDIT
  // — a file another application opens to keep cutting. Nothing about them is the same gesture.
  command({
    id: 'sequence.exportCut',
    scope: 'sequence',
    titleKey: 'commands.sequenceExportCut.title',
    helpKey: 'commands.sequenceExportCut.help',
    defaultBinding: null,
  }),
  // The same edit with its media inside it. Beside the one above rather than a mode of it: this
  // is the file that travels — one settles another application's media pool, the other does not.
  command({
    id: 'sequence.exportBundle',
    scope: 'sequence',
    titleKey: 'commands.sequenceExportBundle.title',
    helpKey: 'commands.sequenceExportBundle.help',
    defaultBinding: null,
  }),
  // The oldest of the three, and beside them for the same reason: an event list carries the cuts
  // and their timecodes and nothing else, which is what an online room asks for and no more.
  command({
    id: 'sequence.exportEdl',
    scope: 'sequence',
    titleKey: 'commands.sequenceExportEdl.title',
    helpKey: 'commands.sequenceExportEdl.help',
    defaultBinding: null,
  }),
  // The program monitor alone answers it: `Monitor` arms the sequence scope on the one that
  // holds the playback token, so the key opens a return on the EDIT, never on the take.
  command({
    id: 'sequence.mirror',
    scope: 'sequence',
    titleKey: 'commands.sequenceMirror.title',
    helpKey: 'commands.sequenceMirror.help',
    // Bare, as DaVinci has it: this is the one gesture taken while WATCHING rather than editing.
    // `KeyF` is spoken for in the scene and the canvas, which are other scopes and never heard
    // at the same time.
    defaultBinding: 'KeyF',
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
    id: 'sequence.unlink',
    scope: 'sequence',
    titleKey: 'commands.sequenceUnlink.title',
    helpKey: 'commands.sequenceUnlink.help',
    // What Premiere and DaVinci both bind it to, and the gesture is the same one.
    defaultBinding: 'Meta+KeyL',
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
    id: 'canvas.mergeDown',
    scope: 'canvas',
    titleKey: 'commands.canvasMergeDown.title',
    helpKey: 'commands.canvasMergeDown.help',
    defaultBinding: 'Meta+KeyE',
  }),
  command({
    id: 'canvas.flatten',
    scope: 'canvas',
    titleKey: 'commands.canvasFlatten.title',
    helpKey: 'commands.canvasFlatten.help',
    defaultBinding: null,
  }),
  command({
    id: 'canvas.flipHorizontal',
    scope: 'canvas',
    titleKey: 'commands.canvasFlipHorizontal.title',
    helpKey: 'commands.canvasFlipHorizontal.help',
    defaultBinding: null,
  }),
  command({
    id: 'canvas.flipVertical',
    scope: 'canvas',
    titleKey: 'commands.canvasFlipVertical.title',
    helpKey: 'commands.canvasFlipVertical.help',
    defaultBinding: null,
  }),
  command({
    id: 'canvas.rotateCw',
    scope: 'canvas',
    titleKey: 'commands.canvasRotateCw.title',
    helpKey: 'commands.canvasRotateCw.help',
    defaultBinding: null,
  }),
  command({
    id: 'canvas.rotateCcw',
    scope: 'canvas',
    titleKey: 'commands.canvasRotateCcw.title',
    helpKey: 'commands.canvasRotateCcw.help',
    defaultBinding: null,
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
  /**
   * Both mean nothing without a crop frame on screen, exactly as `deselect` means nothing without
   * a selection: the handler answers that, not the table. Being commands is what gates them on the
   * document in front — a frame left up on a background tab would otherwise eat the key.
   */
  command({
    id: 'canvas.cropApply',
    scope: 'canvas',
    titleKey: 'commands.canvasCropApply.title',
    helpKey: 'commands.canvasCropApply.help',
    defaultBinding: 'Enter',
  }),
  command({
    id: 'canvas.cropCancel',
    scope: 'canvas',
    titleKey: 'commands.canvasCropCancel.title',
    helpKey: 'commands.canvasCropCancel.help',
    defaultBinding: 'Escape',
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
    /** The stack rather than the flatten — no default binding, ⇧⌘E being the flatten's. */
    id: 'canvas.exportLayered',
    scope: 'canvas',
    titleKey: 'commands.canvasExportLayered.title',
    helpKey: 'commands.canvasExportLayered.help',
    defaultBinding: null,
  }),
  command({
    id: 'canvas.snap',
    scope: 'canvas',
    titleKey: 'commands.canvasSnap.title',
    helpKey: 'commands.canvasSnap.help',
    defaultBinding: 'Shift+Meta+Semicolon',
  }),
  /*
   * Arming a tool. Declared here rather than as strings on the bar, so a key can be remapped
   * in the settings and the button follows — and so the shortcuts screen lists them at all.
   *
   * `L` goes to the lasso, as it does in every editor that has one; the line takes `Shift+R`
   * from the rectangle it belongs beside. They both claimed `L` while nothing listened, and
   * a registry is where that stops being possible.
   *
   * A tool the engine drops every event of gets no command: an unbuilt gesture with a key is
   * a key that does nothing.
   */
  command({
    id: 'canvas.toolMove',
    scope: 'canvas',
    titleKey: 'commands.canvasToolMove.title',
    helpKey: 'commands.canvasToolMove.help',
    defaultBinding: 'KeyV',
  }),
  command({
    id: 'canvas.toolHand',
    scope: 'canvas',
    titleKey: 'commands.canvasToolHand.title',
    helpKey: 'commands.canvasToolHand.help',
    defaultBinding: 'KeyH',
  }),
  command({
    id: 'canvas.toolScale',
    scope: 'canvas',
    titleKey: 'commands.canvasToolScale.title',
    helpKey: 'commands.canvasToolScale.help',
    defaultBinding: 'KeyK',
  }),
  command({
    id: 'canvas.toolCrop',
    scope: 'canvas',
    titleKey: 'commands.canvasToolCrop.title',
    helpKey: 'commands.canvasToolCrop.help',
    defaultBinding: 'KeyF',
  }),
  command({
    id: 'canvas.toolSelectRectangle',
    scope: 'canvas',
    titleKey: 'commands.canvasToolSelectRectangle.title',
    helpKey: 'commands.canvasToolSelectRectangle.help',
    defaultBinding: 'KeyM',
  }),
  command({
    id: 'canvas.toolSelectEllipse',
    scope: 'canvas',
    titleKey: 'commands.canvasToolSelectEllipse.title',
    helpKey: 'commands.canvasToolSelectEllipse.help',
    defaultBinding: null,
  }),
  command({
    id: 'canvas.toolSelectLasso',
    scope: 'canvas',
    titleKey: 'commands.canvasToolSelectLasso.title',
    helpKey: 'commands.canvasToolSelectLasso.help',
    defaultBinding: 'KeyL',
  }),
  command({
    id: 'canvas.toolShapeRectangle',
    scope: 'canvas',
    titleKey: 'commands.canvasToolShapeRectangle.title',
    helpKey: 'commands.canvasToolShapeRectangle.help',
    defaultBinding: 'KeyR',
  }),
  command({
    id: 'canvas.toolShapeLine',
    scope: 'canvas',
    titleKey: 'commands.canvasToolShapeLine.title',
    helpKey: 'commands.canvasToolShapeLine.help',
    defaultBinding: 'Shift+KeyR',
  }),
  command({
    id: 'canvas.toolShapeArrow',
    scope: 'canvas',
    titleKey: 'commands.canvasToolShapeArrow.title',
    helpKey: 'commands.canvasToolShapeArrow.help',
    defaultBinding: 'KeyA',
  }),
  command({
    id: 'canvas.toolShapeEllipse',
    scope: 'canvas',
    titleKey: 'commands.canvasToolShapeEllipse.title',
    helpKey: 'commands.canvasToolShapeEllipse.help',
    defaultBinding: 'KeyO',
  }),
  command({
    id: 'canvas.toolShapePolygon',
    scope: 'canvas',
    titleKey: 'commands.canvasToolShapePolygon.title',
    helpKey: 'commands.canvasToolShapePolygon.help',
    defaultBinding: null,
  }),
  command({
    id: 'canvas.toolShapeStar',
    scope: 'canvas',
    titleKey: 'commands.canvasToolShapeStar.title',
    helpKey: 'commands.canvasToolShapeStar.help',
    defaultBinding: null,
  }),
  command({
    id: 'canvas.toolBrush',
    scope: 'canvas',
    titleKey: 'commands.canvasToolBrush.title',
    helpKey: 'commands.canvasToolBrush.help',
    defaultBinding: 'KeyP',
  }),
  command({
    id: 'canvas.toolPencil',
    scope: 'canvas',
    titleKey: 'commands.canvasToolPencil.title',
    helpKey: 'commands.canvasToolPencil.help',
    defaultBinding: 'Shift+KeyP',
  }),
  command({
    id: 'canvas.toolText',
    scope: 'canvas',
    titleKey: 'commands.canvasToolText.title',
    helpKey: 'commands.canvasToolText.help',
    defaultBinding: 'KeyT',
  }),
  command({
    id: 'canvas.toolEraser',
    scope: 'canvas',
    titleKey: 'commands.canvasToolEraser.title',
    helpKey: 'commands.canvasToolEraser.help',
    defaultBinding: 'KeyE',
  }),
  command({
    id: 'canvas.toolEraserSelection',
    scope: 'canvas',
    titleKey: 'commands.canvasToolEraserSelection.title',
    helpKey: 'commands.canvasToolEraserSelection.help',
    defaultBinding: null,
  }),
  command({
    id: 'canvas.toolFill',
    scope: 'canvas',
    titleKey: 'commands.canvasToolFill.title',
    helpKey: 'commands.canvasToolFill.help',
    defaultBinding: 'KeyG',
  }),
  command({
    id: 'canvas.toolPicker',
    scope: 'canvas',
    titleKey: 'commands.canvasToolPicker.title',
    helpKey: 'commands.canvasToolPicker.help',
    defaultBinding: 'KeyI',
  }),
  // The two bracket keys, as every editor binds them. Physical codes: on AZERTY the same two
  // positions carry ")" and "^", and a signature written from the letter would miss them.
  command({
    id: 'canvas.brushSmaller',
    scope: 'canvas',
    titleKey: 'commands.canvasBrushSmaller.title',
    helpKey: 'commands.canvasBrushSmaller.help',
    defaultBinding: 'BracketLeft',
  }),
  command({
    id: 'canvas.brushLarger',
    scope: 'canvas',
    titleKey: 'commands.canvasBrushLarger.title',
    helpKey: 'commands.canvasBrushLarger.help',
    defaultBinding: 'BracketRight',
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
  command({
    id: 'skybox.view',
    scope: 'skybox',
    titleKey: 'commands.skyboxView.title',
    helpKey: 'commands.skyboxView.help',
    defaultBinding: 'KeyV',
  }),
  command({
    id: 'skybox.probes',
    scope: 'skybox',
    titleKey: 'commands.skyboxProbes.title',
    helpKey: 'commands.skyboxProbes.help',
    defaultBinding: 'KeyP',
  }),
  command({
    id: 'skybox.undo',
    scope: 'skybox',
    titleKey: 'commands.undo.title',
    helpKey: 'commands.undo.help',
    defaultBinding: 'Meta+KeyZ',
  }),
  command({
    id: 'skybox.redo',
    scope: 'skybox',
    titleKey: 'commands.redo.title',
    helpKey: 'commands.redo.help',
    defaultBinding: 'Shift+Meta+KeyZ',
  }),
  // The take editor was one of two surfaces whose history had no key and no menu row: its two
  // buttons were the whole of it, so the bar could not be relieved of them without this pair.
  command({
    id: 'audio.undo',
    scope: 'audio',
    titleKey: 'commands.undo.title',
    helpKey: 'commands.undo.help',
    defaultBinding: 'Meta+KeyZ',
  }),
  command({
    id: 'audio.redo',
    scope: 'audio',
    titleKey: 'commands.redo.title',
    helpKey: 'commands.redo.help',
    defaultBinding: 'Shift+Meta+KeyZ',
  }),

  // The other one, and worse: the manual already promised ⌘Z on a style applied to a material
  // (`docs/fr/manuel/12-espace-textures.md`) while nothing at all could reach that history.
  command({
    id: 'texture.undo',
    scope: 'texture',
    titleKey: 'commands.undo.title',
    helpKey: 'commands.undo.help',
    defaultBinding: 'Meta+KeyZ',
  }),
  command({
    id: 'texture.redo',
    scope: 'texture',
    titleKey: 'commands.redo.title',
    helpKey: 'commands.redo.help',
    defaultBinding: 'Shift+Meta+KeyZ',
  }),
]

export const COMMAND_SCOPES: readonly CommandScope[] = [
  'global',
  'spaces',
  'explorer',
  'scene',
  'sequence',
  'canvas',
  'skybox',
  'audio',
  'texture',
]

/**
 * What each workspace edits, or `null` where it edits nothing undoable.
 *
 * Declared rather than derived: the menu is built in the main process from a workspace id, and
 * it has to name the exact command the surface in front is listening for.
 *
 * **Total, not partial, and that is the guard.** A workspace whose store holds a history and is
 * missing here reaches nothing: the native role keeps the accelerator, ⌘Z never reaches the
 * window, and the failure is silent. It cost Skyboxes once, Audio until its bar
 * was asked to stop drawing the only undo it had, and Textures for as long as the manual
 * promised a key nothing answered. Written as a full `Record`, the next workspace added does
 * not COMPILE until someone answers the question for it — `Partial` let all four slip through.
 *
 * Which of them holds a history is a fact of `renderer/`, invisible from here, so the other half
 * of the guard sits there: `renderer/src/stores/history-scopes.test.ts` walks the document
 * stores and fails on the next one that grows a history while its workspace answers `null`.
 */
const SCOPE_BY_WORKSPACE: Record<WorkspaceId, CommandScope | null> = {
  image: 'canvas',
  '3d': 'scene',
  video: 'sequence',
  skyboxes: 'skybox',
  audio: 'audio',
  textures: 'texture',
}

/**
 * The surface a workspace edits through, or `null` where nothing is undoable — which the home
 * is: it covers the spaces rather than editing one, so it holds no history of its own.
 */
export function scopeOfWorkspace(surface: ToolSurface | null): CommandScope | null {
  return surface && surface !== HOME_SURFACE ? SCOPE_BY_WORKSPACE[surface] : null
}

/** The command of that scope, when it declares one. Every editing scope declares undo and redo. */
export function commandIn(scope: CommandScope, suffix: string): CommandId | null {
  return commandsIn(scope).find(descriptor => descriptor.id.endsWith(`.${suffix}`))?.id ?? null
}

/**
 * The descriptor of a command, or `null` for anything the registry does not declare.
 *
 * Takes a `string` rather than a `CommandId`, the way `assistantAction` does next door, and for
 * the same reason: what asks is often something that has only a name — a language model's answer,
 * an MCP client's call. Narrowing before the call meant two identical casts in two files, each
 * with four lines explaining why it was safe. The check IS this function; there is no gap for a
 * cast to close.
 */
export function commandDescriptor(id: string): CommandDescriptor | null {
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
 * The one key that answers to two names.
 *
 * A Mac's main keyboard carries a single key marked « delete », and it reports `Backspace`. The
 * key that reports `Delete` is a full keyboard's forward-delete, or `fn` held down with the
 * other. A command bound to `Delete` was therefore out of reach on the keyboard most of this
 * studio is used on: pressing the key labelled delete did nothing whatsoever, in every space
 * that binds it — the montage, the scene, the canvas.
 *
 * One way round only: whatever genuinely binds `Backspace` keeps it to itself.
 */
const KEY_ALIASES: Partial<Record<Signature, Signature>> = { Backspace: 'Delete' }

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
  const bound = (wanted: Signature): CommandId | null =>
    COMMAND_REGISTRY.find(
      descriptor =>
        descriptor.scope === scope &&
        !descriptor.held &&
        bindingOf(descriptor.id, overrides) === wanted,
    )?.id ?? null

  // The alias is tried second, so a scope that binds the pressed key outright still wins.
  const alias = KEY_ALIASES[signature]
  return bound(signature) ?? (alias ? bound(alias) : null)
}

/**
 * The held command a signature answers to, on any surface. Held commands are matched across
 * scopes rather than within one: they are heard by the window itself, which is what a release
 * requires, and the menu never claims their key.
 */
export function heldCommandFor(
  signature: Signature,
  overrides: BindingOverrides,
): CommandId | null {
  const found = COMMAND_REGISTRY.find(
    descriptor => descriptor.held && bindingOf(descriptor.id, overrides) === signature,
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
