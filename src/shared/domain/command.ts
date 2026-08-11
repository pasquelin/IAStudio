import type { Signature } from './shortcut'
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
  'global' | 'spaces' | 'scene' | 'sequence' | 'canvas' | 'skybox' | 'graph'

export type CommandId =
  | 'project.new'
  | 'project.open'
  | 'document.save'
  | 'layout.reset'
  | 'app.settings'
  | 'app.dictate'
  | 'window.fullScreen'
  | 'spaces.moveLeft'
  | 'spaces.moveRight'
  | 'scene.select'
  | 'scene.translate'
  | 'scene.rotate'
  | 'scene.scale'
  | 'scene.frame'
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
  | 'canvas.cropApply'
  | 'canvas.cropCancel'
  | 'canvas.maskFromSelection'
  | 'canvas.regenerate'
  | 'canvas.cutout'
  | 'canvas.enlarge'
  | 'canvas.vectorize'
  | 'canvas.extend'
  | 'canvas.export'
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
  | 'graph.run'
  | 'graph.undo'
  | 'graph.redo'

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
  /**
   * Heard while the focus sits in a text field, where every other tapped command is silent.
   *
   * Declared per command rather than deduced from the chord, because the chord is the wrong
   * axis twice over: bindings are remappable, so a rule written on `Meta+…` follows the key
   * instead of the command it opened the field for; and most ⌘ chords have no business firing
   * from a field — `canvas.mergeDown` on ⌘E would flatten a layer while its name is being
   * typed, and the ⌘Z reflex would undo the typing rather than the merge.
   *
   * It must carry a modifier for the same reason `held` must, or it would swallow a letter.
   */
  runsWhileTyping?: boolean
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
  /**
   * The gesture the space exists for, and the only one that had no key at all.
   *
   * A chord rather than a bare letter, and unlike the five image commands that spend credit and
   * ship with nothing: this one is also the Stop, which has to be fast, and `Meta+Enter` is not
   * a key one lands on by accident. It fires nothing on a graph with no node — see `start`.
   *
   * It runs from inside a field because that is where the gesture starts: the prompt is typed
   * into a node, and asking the user to click away before running it is the whole friction this
   * key exists to remove.
   */
  command({
    id: 'graph.run',
    scope: 'graph',
    titleKey: 'commands.graphRun.title',
    helpKey: 'commands.graphRun.help',
    defaultBinding: 'Meta+Enter',
    runsWhileTyping: true,
  }),
  command({
    id: 'graph.undo',
    scope: 'graph',
    titleKey: 'commands.undo.title',
    helpKey: 'commands.undo.help',
    defaultBinding: 'Meta+KeyZ',
  }),
  command({
    id: 'graph.redo',
    scope: 'graph',
    titleKey: 'commands.redo.title',
    helpKey: 'commands.redo.help',
    defaultBinding: 'Shift+Meta+KeyZ',
  }),
]

export const COMMAND_SCOPES: readonly CommandScope[] = [
  'global',
  'spaces',
  'scene',
  'sequence',
  'canvas',
  'skybox',
  'graph',
]

/**
 * What each workspace edits, when it edits something undoable. The absent ones — Audio and
 * Textures — have no history of their own, so the native undo keeps the key.
 *
 * Declared rather than derived: the menu is built in the main process from a workspace id, and
 * it has to name the exact command the surface in front is listening for.
 *
 * A workspace whose store DOES hold a history and is missing here is the one failure this table
 * can have, and it is silent: the native role keeps the accelerator, so ⌘Z never reaches the
 * window. It cost Skyboxes once and the graph once — `command.test.ts` now names them all.
 */
const SCOPE_BY_WORKSPACE: Partial<Record<WorkspaceId, CommandScope>> = {
  image: 'canvas',
  '3d': 'scene',
  video: 'sequence',
  skyboxes: 'skybox',
  graph: 'graph',
}

/** The surface a workspace edits through, or `null` where nothing is undoable. */
export function scopeOfWorkspace(workspace: WorkspaceId | null): CommandScope | null {
  return workspace ? (SCOPE_BY_WORKSPACE[workspace] ?? null) : null
}

/** The command of that scope, when it declares one — `undo` and `redo` exist on all three. */
export function commandIn(scope: CommandScope, suffix: string): CommandId | null {
  return commandsIn(scope).find(descriptor => descriptor.id.endsWith(`.${suffix}`))?.id ?? null
}

export function commandDescriptor(id: CommandId): CommandDescriptor | null {
  return COMMAND_REGISTRY.find(descriptor => descriptor.id === id) ?? null
}

/** Whether a command is one of the few heard from inside a text field. */
export function runsWhileTyping(id: CommandId): boolean {
  return commandDescriptor(id)?.runsWhileTyping === true
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
    descriptor =>
      descriptor.scope === scope &&
      !descriptor.held &&
      bindingOf(descriptor.id, overrides) === signature,
  )
  return found?.id ?? null
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
