import { orElse } from '@shared/promises'
import type { Asset } from '@shared/domain/asset'
import {
  DOCUMENT_KIND_KEY,
  type CloseChoice,
  type DocumentDescriptor,
  type DocumentDraft,
  type DocumentKind,
} from '@shared/domain/document'
import { ORA_MERGED_PATH, type OraSurface } from '@shared/domain/openRaster'
import { FOLDER_ROOT, parentOf } from '@shared/domain/folder'
import { chainsOnMontage, parseAudioEdits, EMPTY_AUDIO_EDIT } from '@/engines/audio/edits'
import { createDefaultScene } from '@/engines/scene/defaultScene'
import {
  forgetCarriedScene,
  sceneFromPayloadFile,
  scenePayloadOf,
  sceneRefusesToSave,
} from './sceneDocument'
import {
  EMPTY_SEQUENCE,
  EMPTY_SOUND_SEQUENCE,
  type SequenceState,
} from '@/engines/timeline/timelineState'
import { otioStudioMetadata } from '@shared/domain/otio'
import {
  formatOfFile,
  lossesFor,
  type CapabilityTrait,
  type WritableFormat,
} from '@shared/domain/formatCapability'
import { traitsOfCanvas } from '@/engines/canvas/canvasTraits'
import {
  canvasFromOra,
  canvasFromOraContent,
  oraStackFromContent,
  oraStackOf,
  oraSurfacesOf,
} from '@/engines/canvas/oraDocument'
import { bytesToBase64 } from '@/helpers/base64'
import { getBridge } from '@/services/bridge'
import type { StudioBridge } from '@shared/ipc'
import { reportFailure, reportNotice } from '@/services/diagnostics'
import i18next from 'i18next'
import { closePanel, openDocument } from './dockviewApi'
import { codeFileOf, isCodeDirty, scriptRefAt, scriptRefOf, useCode } from '@/stores/code'
import {
  forgetCarriedMetadata,
  montageIsIncomplete,
  sequenceFromPayload,
  sequencePayload,
  serializeSequencePayload,
} from './sequenceDocument'
import {
  forgetCarriedSky,
  skyboxFromPayload,
  skyboxPayload,
  skyRefusesToSave,
} from './skyboxDocument'
import { assetsById, useAssets } from '@/stores/assets'
import { useDocuments } from '@/stores/documents'
import { useLivePreviews } from '@/stores/livePreviews'
import { audioEditStore } from '@/stores/audioEdits'
import { sceneStore } from '@/stores/scenes'
import { sequenceStore } from '@/stores/sequences'
import { skyboxStore } from '@/stores/skyboxes'
import type { DocumentStore } from '@/stores/documentStore'
import { DEFAULT_CANVAS } from '@/engines/canvas/canvasState'
import { canvasHost } from '@/spaces/image/canvasHosts'
import { canvasStore, canvasOf, useCanvases } from '@/stores/canvases'
import { newMaterial } from '@/engines/material/materialState'
import {
  forgetCarriedMaterial,
  materialRefusesToSave,
  materialFromPayload,
  materialPayload,
} from './materialDocument'
import { useMonitorPair } from '@/stores/monitorPair'
import { useSkyboxViews } from '@/stores/skyboxViews'
import { useMaterialViews } from '@/stores/materialViews'
import { materialStore } from '@/stores/materials'
import { createSkyboxContent } from '@shared/domain/skybox'

/** What an editor produces to be saved. The title is the tab's, not the editor's. */
type CapturedDraft = Omit<DocumentDraft, 'title'>

/**
 * Where a baked document lands: over the asset it was opened from — ⌘S — or beside it — ⌘⇧S.
 *
 * Overwriting is only safe because the engine leaves a layer whose pixels the document restored
 * alone; `LayerSurface.fromDocument` holds that rule and the reason for it.
 *
 * Both fields optional, and both are sent flat, because `SaveAudioRequest` is shaped that way
 * and two sibling channels saying the same thing differently is worse than a field that goes
 * unread — see `name` below.
 */
export type AssetTarget = {
  /** The asset to overwrite. Absent writes a new one instead. */
  replaces?: string
  /** The picture the new one was edited from. An overwrite keeps the filiation it already had. */
  derivedFrom?: string
  /** Names a NEW asset. Ignored by an overwrite, which keeps the name the asset already has. */
  name: string
  /**
   * Which format to write. An overwrite passes the one the file already IS — writing a `.ora`
   * back as a PNG would destroy the very stack the container was chosen to hold.
   */
  format: WritableFormat
}

/**
 * How a kind reaches the disk and comes back. One entry per space that has a serialized form; a
 * kind absent from the table cannot be saved yet, and Save does nothing for it rather than
 * writing a document with an empty body.
 */
type DocumentIo = AssetWriting & {
  /**
   * What to write, how to record that it was written, and whether there was anything to write.
   *
   * Asynchronous because an image's pixels live on the GPU and only come back through a promise.
   * **The mark is read synchronously, before the first `await`** — that is the whole property:
   * an edit made while the file is on its way to disk must not be counted as saved.
   *
   * `wasEdited` is read at that same instant, and it is here rather than at the caller for the
   * same reason: `commit` clears the mark, so a caller asking afterwards always hears "no". It
   * is what stops ⌘S on an untouched tab from rewriting the asset behind it.
   */
  capture: (
    documentId: string,
  ) => Promise<{ draft: CapturedDraft; commit: () => void; wasEdited: boolean }>
  install: (documentId: string, content: string, parts?: readonly OraSurface[]) => void
  /**
   * Hands a FRESH engine the pixels the document already has on disk, leaving the state alone.
   *
   * Only a kind whose pixels live outside its state needs one, which is the image alone. It
   * exists because a remount does not lose the state: `DocumentArea` is keyed on the workspace,
   * so switching space and back rebuilds every engine — and `restoreDocument` reads the file
   * only when the state is MISSING. The new engine therefore came up with the whole stack and
   * none of the pixels: every layer blank, except the ones carrying `source`, which redrew from
   * their asset — and once ⌘S writes the flattened stack into that asset, redrawing from it
   * folds the whole picture into the one layer it came from.
   */
  rehydrate?: (documentId: string, content: string, parts: readonly OraSurface[]) => void
  /**
   * The same, for a tab whose pixels are still in the ASSET it was opened from — a container
   * opened and not yet saved has no document file to read them out of.
   */
  rehydrateFromAsset?: (documentId: string, assetId: string) => Promise<void>
  /** What an unsaved document holds until something is done to it. */
  createDefault: (documentId: string) => void
  /**
   * Whether a pass on a timer may write this kind. Absent means yes.
   *
   * A property of the kind rather than a list beside the table: what makes autosave unsafe is
   * what `capture` costs, and that is known here and nowhere else.
   */
  autosaves?: false
  /** Whether the document is already filled — a remount must not read over what is open. */
  holds: (documentId: string) => boolean
  /**
   * The sentence to refuse a save with, or `null` — for a document that opened holding LESS than
   * its file did: a montage whose media the project has none of, a sky whose glTF holds a scene.
   * Absent means the kind cannot open partly.
   *
   * The SENTENCE rather than a yes: what to import, and what would be erased, differ per kind, and
   * one message for both told the owner of a sky to go and find some missing clips.
   *
   * Writing one back deletes what could not be read, and nothing on screen says so: `install`
   * marks the document clean whatever it managed to restore.
   */
  incomplete?: (documentId: string) => string | null
  /** Whether closing the document would throw work away — never true for an untouched tab. */
  dirty: (documentId: string) => boolean
  /** Drops the state and the history a closed document was holding. The DESCRIPTOR, because a
   * script is keyed by its path, which no lookup answers once the document has left the store. */
  forget: (document: DocumentDescriptor) => void
}

/**
 * Whether a kind writes back over the file it was opened from — and if it does, what it holds.
 *
 * **The two travel together, and the compiler is what keeps them together.** Declaring
 * `writeAsset` without `traitsOf` would make `writePlanFor` answer « nothing to lose » for
 * everything that kind can hold, and the next space to bake into its source would silently
 * reopen the defect this whole feature closed — in another workspace, with every gate green.
 * Five kinds take the first branch today, each saying why at its own line of `IO_BY_KIND`.
 */
type AssetWriting =
  | { writeAsset?: undefined; traitsOf?: undefined }
  | {
      /**
       * Bakes the document into the asset it was opened from — ⌘S — or into a new one beside
       * it — ⌘⇧S. Which of the two is what `target` says.
       *
       * The kind writes it itself rather than handing bytes back: what a picture sends and what
       * a take would send do not have the same shape, and a shared return type would be a union
       * every caller had to take apart again.
       *
       * Answers `null` when there was nothing to bake yet — an engine whose GPU context is
       * still coming up, which is exactly when a save right after switching workspace lands.
       *
       * `captured` is the draft the document was written from, and it is handed over rather than
       * taken again: an image's bytes come off the graphics card, and asking twice per ⌘S doubles
       * a freeze that grows with the stack.
       */
      writeAsset: (
        documentId: string,
        target: AssetTarget,
        captured: CapturedDraft,
      ) => Promise<Asset | null>
      /** What this document holds that the target format has to carry, measured on its state. */
      traitsOf: (documentId: string) => CapabilityTrait[]
    }

/**
 * The kinds a string can hold, which differ only in what their state becomes on the way out and
 * how it is read back in. Written once: the bookkeeping around the crossing — read the mark
 * before the write, hand it back after, load outside the history, open clean — is the same for
 * all of them, and a copy per kind meant a fix landing in one space and not the others.
 *
 * JSON is crossed HERE, never by a caller. A `SyntaxError` from a file that is not JSON at all
 * is what marks the document unreadable and stops the next ⌘S from writing over it — a kind
 * whose own reader swallowed that would lose the protection with nothing to catch it.
 */
type TextDocumentCodec<S> = {
  toPayload: (state: S, documentId: string) => unknown
  fromPayload: (payload: unknown, documentId: string) => S
  createDefault: () => S
  /**
   * How the payload becomes the file's bytes. A kind held in an open format writes it the way an
   * export of it would — read by hand and by other tools — where the studio's own stays compact.
   */
  serialize?: (payload: unknown) => string
}

function textDocumentIo<S>(
  store: DocumentStore<S>,
  {
    toPayload,
    fromPayload,
    createDefault,
    serialize = payload => JSON.stringify(payload),
  }: TextDocumentCodec<S>,
): DocumentIo {
  return {
    capture: documentId => {
      const current = store.use.getState()
      const mark = store.markOf(current, documentId)

      return Promise.resolve({
        // Serialized in the window that owns the document: the file layer never parses a
        // content, so the biggest of them is never decoded in the main process.
        draft: { content: serialize(toPayload(store.stateOf(current, documentId), documentId)) },
        commit: () => store.use.getState().markSaved(documentId, mark),
        wasEdited: store.hasUnsavedWork(current, documentId),
      })
    },
    install: (documentId, content) => {
      // `replace`, not a command: loading a document is not something ⌘Z gives back.
      store.use.getState().replace(documentId, fromPayload(JSON.parse(content), documentId))
      // What is on screen is now exactly what the disk holds, so the document opens clean.
      const loaded = store.use.getState()
      loaded.markSaved(documentId, store.markOf(loaded, documentId))
    },
    createDefault: documentId => store.use.getState().ensure(documentId, createDefault),
    holds: documentId => store.hasState(store.use.getState(), documentId),
    dirty: documentId => store.hasUnsavedWork(store.use.getState(), documentId),
    forget: document => store.use.getState().drop(document.id),
  }
}

/**
 * The key the chain of effects travels under, inside the studio domain of a take's timeline. No
 * standard carries a non-destructive chain, so it rides beside the montage rather than in it —
 * invisible to another application, which is what `formatCapability` calls extended.
 */
const OTIO_AUDIO_EDITS = 'audioEdits'

/**
 * Whether either half of a take holds work nobody has written yet. Read from a snapshot rather
 * than from the live stores, because `capture` must ask it BEFORE its first `await` — an edit
 * made while the file is on its way to disk must not be counted as saved.
 */
function audioHasUnsavedWork(
  documentId: string,
  edits = audioEditStore.use.getState(),
  montage = sequenceStore.use.getState(),
): boolean {
  return (
    audioEditStore.hasUnsavedWork(edits, documentId) ||
    sequenceStore.hasUnsavedWork(montage, documentId)
  )
}

/**
 * A montage read back for a take, kept to sound alone.
 *
 * Identity, not emptiness: the reader hands back `EMPTY_SEQUENCE` — which carries a PICTURE
 * track — both for a file it could not read and for a montage whose last track was removed, and
 * either way the Audio workspace would reopen holding a row it has no monitor to play.
 */
function soundMontageOf(parsed: SequenceState): SequenceState {
  if (parsed === EMPTY_SEQUENCE) return EMPTY_SOUND_SEQUENCE

  const tracks = parsed.tracks.filter(track => track.kind === 'audio')
  return tracks.length === 0 ? EMPTY_SOUND_SEQUENCE : { ...parsed, tracks }
}

/**
 * The take, which is the one kind holding TWO states: the chain of edits over a sample, and the
 * sound montage the timeline shows under it. Both are the same document — one tab, one ⌘S, one
 * file — so neither generic path fits, and the composition is written out here.
 *
 * The montage half is why the Audio workspace is a workspace at all rather than a sample editor:
 * music is built by laying takes side by side, and a montage lost on close is a session lost.
 */
const AUDIO_IO: DocumentIo = {
  capture: documentId => {
    const edits = audioEditStore.use.getState()
    const montage = sequenceStore.use.getState()
    const editMark = audioEditStore.markOf(edits, documentId)
    const montageMark = sequenceStore.markOf(montage, documentId)
    const written = sequenceStore.stateOf(montage, documentId)

    return Promise.resolve({
      draft: {
        content: serializeSequencePayload(
          sequencePayload(written, documentId, {
            [DOCUMENT_KIND_KEY]: 'audio',
            // Pruned on the way to the file and nowhere else — see `chainsOnMontage`: the store
            // keeps every chain so that ⌘Z of a deleted block gives its settings back.
            [OTIO_AUDIO_EDITS]: chainsOnMontage(audioEditStore.stateOf(edits, documentId), written),
          }),
        ),
      },
      commit: () => {
        audioEditStore.use.getState().markSaved(documentId, editMark)
        sequenceStore.use.getState().markSaved(documentId, montageMark)
      },
      // Either half is the document: a montage built over an untouched take is work to save.
      wasEdited: audioHasUnsavedWork(documentId, edits, montage),
    })
  },

  install: (documentId, content) => {
    const payload: unknown = JSON.parse(content)

    // `replace`, not a command: loading a document is not something ⌘Z gives back.
    audioEditStore.use
      .getState()
      .replace(documentId, parseAudioEdits(otioStudioMetadata(payload)[OTIO_AUDIO_EDITS]))
    sequenceStore.use
      .getState()
      .replace(documentId, soundMontageOf(sequenceFromPayload(payload, documentId)))

    const edits = audioEditStore.use.getState()
    edits.markSaved(documentId, audioEditStore.markOf(edits, documentId))
    const montage = sequenceStore.use.getState()
    montage.markSaved(documentId, sequenceStore.markOf(montage, documentId))
  },

  createDefault: documentId => {
    audioEditStore.use.getState().ensure(documentId, () => EMPTY_AUDIO_EDIT)
    sequenceStore.use.getState().ensure(documentId, () => EMPTY_SOUND_SEQUENCE)
  },

  // The chain alone answers: it is the half a fresh tab always has, and a montage installed by
  // the panel before the file is read would make an unopened document look already filled.
  holds: documentId => audioEditStore.hasState(audioEditStore.use.getState(), documentId),

  dirty: audioHasUnsavedWork,

  // The same reader as the video montage, so the same refusal: a take whose media the project has
  // none of opens shorter than its file, and writing it back would delete those clips for good.
  incomplete: montageIsIncomplete,

  forget: ({ id }) => {
    audioEditStore.use.getState().drop(id)
    sequenceStore.use.getState().drop(id)
    forgetCarriedMetadata(id)
  },
}

/**
 * The stack, into the asset it was opened from — out of the capture ⌘S already paid for.
 *
 * Nothing is asked of the engine here, and that is the point: reading a layer's texture back off
 * the card is a synchronous `gl.readPixels`, and this half of the gesture wants the very bytes the
 * other half has just written. It is also what keeps the two from disagreeing — a stroke landing
 * while the document is on its way to disk would otherwise reach the asset and not the file.
 *
 * `null` for a stack that will not parse: the asset is replaced whole, so writing an empty one
 * would destroy the picture in the file it names.
 */
async function layeredAsset(
  captured: CapturedDraft,
  target: AssetTarget,
  bridge: StudioBridge,
): Promise<Asset | null> {
  const stack = oraStackFromContent(captured.content)
  if (!stack) return null

  return await bridge.assets.saveLayered({
    ...target,
    document: { stack, surfaces: captured.parts ?? [] },
  })
}

/** The flatten alone, for a format that holds no layers. Base64, as `savePicture` takes it. */
async function flatAsset(
  captured: CapturedDraft,
  target: AssetTarget,
  bridge: StudioBridge,
): Promise<Asset | null> {
  // The same entry every other application draws of a container, taken from the capture rather
  // than flattened a second time — `snapshot()` IS `flatten()` with a base64 pass after it.
  const merged = captured.parts?.find(one => one.path === ORA_MERGED_PATH)
  if (!merged) return null
  return await bridge.assets.savePicture({ ...target, png: bytesToBase64(merged.png) })
}

/**
 * The image, which is the one kind a string cannot hold: its file IS an OpenRaster container —
 * `content` is the stack as JSON, and each surface a PNG entry beside it. The pixels live on the
 * GPU, so they are asked of the engine holding the document — see `canvasHost`.
 */
const IMAGE_IO: DocumentIo = {
  /**
   * Capturing means reading every layer's texture back off the graphics card, and that cost is
   * unmeasured. Paying it on a timer while someone is drawing would trade a stutter every half
   * minute for work ⌘S already keeps. The exclusion lifts the day it is measured, not before.
   */
  autosaves: false,
  capture: async documentId => {
    const canvases = useCanvases.getState()
    // Read before the first await, which is the whole reason `capture` may be asynchronous: an
    // edit made while the pixels are being extracted must not be counted as saved.
    const mark = canvasStore.markOf(canvases, documentId)
    const wasEdited = canvasStore.hasUnsavedWork(canvases, documentId)
    const state = canvasOf(canvases, documentId)

    const host = canvasHost(documentId)
    // Refused rather than written empty. The container is replaced whole, so a save with no
    // pictures would delete the ones on disk AND mark the document clean — the work would be
    // gone with nothing said. The engine is unreachable while it boots its GPU context, which is
    // exactly when a ⌘S after switching workspace lands.
    if (!host) throw new Error(`No editor holds ${documentId}: its pixels cannot be read`)

    // The flatten is what every OTHER application draws of this file, and the spec requires it.
    // Refused for the same reason as the engine: a container without one opens as nothing, with
    // the layers inside it intact and unreachable.
    const merged = await host.flatten()
    if (!merged)
      throw new Error(`No flatten for ${documentId}: the container would open as nothing`)

    const parts = oraSurfacesOf(await host.pixelSnapshots(), merged)

    return {
      draft: { content: JSON.stringify(oraStackOf(state, parts)), parts },
      commit: () => useCanvases.getState().markSaved(documentId, mark),
      wasEdited,
    }
  },
  install: (documentId, content, parts = []) => {
    const canvases = useCanvases.getState()
    // `replace`, not a command: loading a document is not something ⌘Z gives back.
    canvases.replace(documentId, canvasFromOraContent(content, parts).state)
    canvases.markSaved(documentId, canvasStore.markOf(useCanvases.getState(), documentId))

    // After the state, never before: the engine builds a surface per layer of the state it was
    // given, and pixels aimed at a layer it has not heard of yet land nowhere.
    IMAGE_IO.rehydrate?.(documentId, content, parts)
  },
  rehydrate: (documentId, content, parts) => {
    const host = canvasHost(documentId)
    if (!host) return
    // Through the stack rather than by name alone: a container written elsewhere names its
    // surfaces its own way, and only the stack says which layer each belongs to. The ids it
    // invents are positional, so the same file gives the same ones the state was built with.
    // Sequenced, not fired all at once: each of these decodes a PNG and renders it, and a
    // twenty-layer container launched twenty of them into the same frame. Opening does not need
    // to be parallel, it needs not to saturate.
    void (async () => {
      for (const pixels of canvasFromOraContent(content, parts).pixels) {
        // Nothing is rethrown into a mount effect that has nowhere to show it — see
        // `restoreDocument`.
        await orElse(host.restoreSnapshot(pixels), undefined)
      }
    })()
  },
  /**
   * The container is read a SECOND time here — `becomeAsset` read it to build the stack, and no
   * engine existed then to hand the pixels to. Kept rather than cached: it is one gesture, not a
   * hot path, and a cache of the last container read would outlive the tab that wanted it.
   */
  rehydrateFromAsset: async (documentId, assetId) => {
    const host = canvasHost(documentId)
    const layered = host ? await getBridge()?.assets.readLayered(assetId) : null
    if (!host || !layered) return

    // Sequenced for the reason `rehydrate` above is.
    for (const pixels of canvasFromOra(layered).pixels) {
      await orElse(host.restoreSnapshot(pixels), undefined)
    }
  },
  writeAsset: async (documentId, target, captured) => {
    const bridge = getBridge()
    const host = canvasHost(documentId)
    if (!bridge || !host) return null

    // The flatten goes back at the DOCUMENT's size, whatever that has become. Editing a picture
    // is allowed to change its dimensions — a crop is an edit like any other — so a save that
    // refused a resized document would be an image editor that cannot crop. What guards the
    // asset is that an untouched tab never writes at all (`wasEdited`), and that ⌘⇧S is there
    // for whoever wants the result beside the original rather than over it.
    //
    // Said, though, and this is what the removed refusal left behind: `replaceBytes` deletes
    // what it replaces, so a document that drifted without anyone meaning it to shrinks the
    // original in silence.
    //
    // NOT awaited, and that is the difference from the refusal it replaces. This only SAYS
    // something — the save happens either way — so making ⌘S wait on a picture decode would buy
    // nothing and cost the responsiveness of the one gesture that must never feel stuck.
    // Through `import()` for the reason `placeAsset` gives: this file is in the opening chunk.
    const replaced = target.replaces
    if (replaced) {
      void import('@/spaces/image/assetFidelity')
        .then(({ reportAssetDrift }) => reportAssetDrift(documentId, replaced, target.name))
        // Nothing is rethrown into a save: a notice that cannot be given has nowhere to go, and
        // an unhandled rejection here would be the only trace of it.
        .catch(() => undefined)
    }

    // `null` while the engine boots its GPU context, which is exactly when a ⌘S after switching
    // workspace lands. The document is still written; only the asset waits for the next save.
    const written = await (target.format === 'ora'
      ? layeredAsset(captured, target, bridge)
      : flatAsset(captured, target, bridge))
    if (!written) return null
    // After the write, and only for an overwrite: the id did not move, so the loader would keep
    // answering with the picture it cached before this save.
    if (target.replaces) await host.forgetPicture(target.replaces)
    return written
  },
  traitsOf: documentId => traitsOfCanvas(canvasOf(useCanvases.getState(), documentId)),
  createDefault: documentId => useCanvases.getState().ensure(documentId, () => DEFAULT_CANVAS),
  holds: documentId => canvasStore.hasState(useCanvases.getState(), documentId),
  dirty: documentId => canvasStore.hasUnsavedWork(useCanvases.getState(), documentId),
  forget: document => useCanvases.getState().drop(document.id),
}

/**
 * A script IS its text, held by `useCode` under the `script:` reference the game, the `Script`
 * component and the assistant all name — this adapts the one to the other.
 *
 * No history and no `markSaved` of a command: Monaco holds the undo a cursor in a text expects,
 * which is why Code answers `null` in `SCOPE_BY_WORKSPACE`.
 */
const SCRIPT_IO: DocumentIo = {
  capture: documentId => {
    const script = scriptRefOf(documentId)
    const held = codeFileOf(documentId)
    // Read before the first `await`, like every other kind: what is written is this text, and a
    // keystroke landing while it is on its way to disk must not be counted as saved.
    const source = held?.source ?? ''

    return Promise.resolve({
      draft: { content: source },
      commit: () => {
        if (script !== null) useCode.getState().committed(script, source)
      },
      wasEdited: isCodeDirty(held),
    })
  },
  install: (documentId, content) => {
    const script = scriptRefOf(documentId)
    if (script !== null) useCode.getState().installed(script, content)
  },
  // Empty, and NOT the starter: a script exists on disk before it has a tab, so reaching here
  // means a file that could not be read — a starter would offer to overwrite it.
  createDefault: documentId => {
    const script = scriptRefOf(documentId)
    if (script !== null && codeFileOf(documentId) === undefined) {
      useCode.getState().installed(script, '')
    }
  },
  holds: documentId => codeFileOf(documentId) !== undefined,
  dirty: documentId => isCodeDirty(codeFileOf(documentId)),
  forget: document => useCode.getState().forget(scriptRefAt(document.path)),
}

/**
 * Every kind the studio can write, and the only place a kind is declared savable. A kind absent
 * here has a Save that does nothing rather than one that writes an empty body.
 */
const IO_BY_KIND: Record<DocumentKind, DocumentIo> = {
  image: IMAGE_IO,
  // No `writeAsset`, and the reason is the kind itself: a scene is not a mesh — the asset it was
  // opened from is one node of it.
  scene: {
    ...textDocumentIo(sceneStore, {
      toPayload: scenePayloadOf,
      fromPayload: sceneFromPayloadFile,
      createDefault: createDefaultScene,
    }),
    // A scene the studio wrote and Blender then enriched still LISTS — its extras are ours — and
    // a save recomposes the whole document from the state. glTF links by INDEX, so the meshes and
    // buffers it gained cannot be carried across half way. Refused rather than silently dropped.
    incomplete: sceneRefusesToSave,
    forget: ({ id }) => {
      sceneStore.use.getState().drop(id)
      forgetCarriedScene(id)
    },
  },
  // Nor here: rendering a montage is minutes of work, which has no business on a keystroke.
  sequence: {
    ...textDocumentIo(sequenceStore, {
      toPayload: sequencePayload,
      fromPayload: sequenceFromPayload,
      createDefault: () => EMPTY_SEQUENCE,
      serialize: serializeSequencePayload,
    }),
    incomplete: montageIsIncomplete,
    forget: ({ id }) => {
      sequenceStore.use.getState().drop(id)
      forgetCarriedMetadata(id)
    },
  },
  // No `writeAsset`, for the reason the editor states itself: a take is a REPLAYABLE chain over
  // a decoded source, and « nothing is written to disk until apply or save as ». Baking it into
  // its own source would leave the chain in the document and apply it a second time on reopen —
  // and its own toolbar already offers both writes, where a hand asks for them.
  audio: AUDIO_IO,
  // Nor here: `adjustments` are applied over a source left intact, and baking them into it would
  // destroy the only copy of what they are meant to stay undoable against.
  // A sky IS its glTF: the sun is a `KHR_lights_punctual` light, the horizon a node rotation, and
  // the picture a file referenced beside the document rather than an id no other reader resolves.
  skybox: {
    ...textDocumentIo(skyboxStore, {
      // No `serialize` of its own: the file layer parses this content to stamp the title into the
      // standard, and writes the glTF back compact. An indented string here is built, crossed and
      // thrown away — measured on the file it produces, which is on one line.
      toPayload: skyboxPayload,
      fromPayload: skyboxFromPayload,
      createDefault: createSkyboxContent,
    }),
    // glTF is an index-linked graph: a file holding a mesh or a camera cannot be half rewritten,
    // and the nodes are recomposed from two. Refused rather than flattened.
    incomplete: skyRefusesToSave,
    forget: ({ id }) => {
      skyboxStore.use.getState().drop(id)
      // Dropped with the document, so a reopened id never inherits the link another file carried.
      forgetCarriedSky(id)
    },
  },
  // A material IS its MaterialX: each channel is a `tiledimage` reading a file beside the
  // document, and the dials the standard has no input for ride in the attribute it reserves for
  // applications. The one whose absence is NOT a refusal: a channel is a reference, not pixels,
  // and what does produce pixels — `deriveChannel` — already writes them as an asset.
  script: SCRIPT_IO,
  material: {
    ...textDocumentIo(materialStore, {
      toPayload: materialPayload,
      fromPayload: materialFromPayload,
      createDefault: newMaterial,
    }),
    // One material is rewritten from one state: a file holding a second one, or a look, cannot be
    // half rewritten. Refused rather than flattened, exactly as a sky holding a scene is.
    incomplete: materialRefusesToSave,
    forget: ({ id }) => {
      materialStore.use.getState().drop(id)
      // Dropped with the document, so a reopened id never inherits the paths another file carried.
      forgetCarriedMaterial(id)
    },
  },
}

/** `undefined` for an id no tab is showing — never for a kind that cannot be saved. */
const ioOf = (documentId: string): DocumentIo | undefined => {
  const kind = useDocuments.getState().documents[documentId]?.kind
  return kind && IO_BY_KIND[kind]
}

/**
 * Documents whose file would not read. Their tab shows an empty editor, which is indistinguishable
 * from a new one — so without this the user adds a node, the state exists, and the next ⌘S writes
 * that over the scene nothing could read. The file is the only copy: refusing to write it is the
 * one safe answer, and it stands until the document is opened again.
 */
const unreadable = new Set<string>()

/**
 * Documents whose asset has not caught up with them.
 *
 * `commit` clears the mark the moment the document itself reaches disk, so "was edited" is true
 * exactly once. A ⌘S whose second half failed — a full disk, an engine still booting its GPU
 * context — would therefore never try again: the shelf, the scene and every other consumer would
 * stand on the pre-edit picture for good, with no bullet to say so, and pressing ⌘S again would
 * do nothing at all. Remembered here instead, and the next save retries whether or not anything
 * was edited in between.
 */
const assetBehind = new Set<string>()

/** Documents whose flatten has been agreed to. ⌘S asks once; asking at each would be unbearable. */
const flattenAgreed = new Set<string>()

/**
 * Whether the asset may take the flatten — asked once per document, remembered for the session.
 *
 * A refusal leaves the DOCUMENT written, which is why it is not a failure and arms no debt: the
 * work is on disk either way, and only the picture the scene reads stays behind.
 */
async function agreedToFlatten(
  document: DocumentDescriptor,
  format: WritableFormat,
  losses: readonly CapabilityTrait[],
): Promise<boolean> {
  if (flattenAgreed.has(document.id)) return true

  const agreed = await askedToFlatten(
    document.title,
    format.toUpperCase(),
    // Translated HERE: a dialogue reading « layers, liveText » to a French speaker is the rawest
    // form of this repository's costliest defect. Only picture traits arrive — see `traitsOf`.
    losses.map(trait => i18next.t(`traits.${trait}`)).join(', '),
  )
  if (agreed) flattenAgreed.add(document.id)
  return agreed
}

/** No bridge — a test, a plain browser — answers yes: there is nobody to ask and nothing to lose. */
const askedToFlatten = async (title: string, format: string, lost: string): Promise<boolean> =>
  (await getBridge()?.documents.confirmFlatten(title, format, lost)) ?? true

/**
 * What both saving gestures need before they can write anything, or `null` when one of them is
 * missing — which is the same refusal for both, said once.
 *
 * `holds` separates "empty scene" from "no scene yet", and `unreadable` is the file that would
 * not read: writing over it is the one thing that loses work irrecoverably, so neither gesture
 * gets past this.
 */
function savableDocument(
  documentId: string,
  byHand = true,
): { bridge: StudioBridge; document: DocumentDescriptor; io: DocumentIo } | null {
  const bridge = getBridge()
  const document = useDocuments.getState().documents[documentId]
  const io = ioOf(documentId)
  if (!bridge || !document || !io) return null
  if (unreadable.has(documentId) || !io.holds(documentId)) return null

  const refusal = io.incomplete?.(documentId)
  if (refusal) {
    // Said to a KEYSTROKE, and only to one: a ⌘S that writes nothing without a word is
    // indistinguishable from one that worked. The autosave says nothing at all — `document.save`
    // is a gesture scope, so it is never deduplicated, and a refused document is refused on
    // every pass: the sentence would land in front of the user every thirty seconds, for good.
    if (byHand) reportNotice('document.save', refusal)
    return null
  }

  return { bridge, document, io }
}

/**
 * Writes the document to the project, and then the asset it edits — what ⌘S means on a tab
 * opened from the shelf. A document whose state was never filled is refused: `holds` separates
 * "empty scene" from "no scene yet".
 *
 * Answers whether anything was written. A refusal is not a failure — there was nothing to write,
 * or the file must not be written over — but a caller about to throw the state away has to be
 * able to tell that from a save that happened. It is what stops "Save" on a document whose file
 * would not read from closing the tab on work that never reached the disk.
 */
export async function saveDocument(documentId: string, byHand = true): Promise<boolean> {
  const savable = savableDocument(documentId, byHand)
  if (!savable) return false
  const { bridge, document, io } = savable

  const { draft, commit, wasEdited } = await io.capture(documentId)
  const payload = {
    ...draft,
    title: document.title,
    // Written from the descriptor for the same reason the title is: the tab owns both, and the
    // captured draft is the editor's state alone.
    ...(document.sourceAssetId ? { sourceAssetId: document.sourceAssetId } : {}),
  }

  // Nothing is captured a second time on the way through: the draft above is the state the user
  // pressed ⌘S on, and re-capturing after a dialog would save whatever was typed during it.
  // The folder the descriptor names, which for a document never saved is the one its author
  // picked. The writer reads it only when there is no file yet, so a save never moves anything.
  const folder = parentOf(document.path) ?? FOLDER_ROOT

  if (
    (await bridge.documents.write(document.id, document.kind, payload, false, folder)) === 'stale'
  ) {
    if (!byHand || !(await bridge.documents.confirmOverwrite(document.title))) return false
    await bridge.documents.write(document.id, document.kind, payload, true, folder)
  }
  commit()

  /**
   * A pass on a timer writes the DOCUMENT and stops there.
   *
   * Baking the asset again reads an editor's pixels back off the GPU, and `relist` walks the
   * whole folder reading a head per entry — both on the UI thread, both once per open document,
   * every thirty seconds, for a picture only the shelf shows.
   *
   * Nothing is owed to `assetBehind` either, and that is worth saying because it looks like an
   * omission: the one kind carrying a `writeAsset` is the image, and the image is the one kind
   * that opts out of autosave. The day a second kind carries one, this is the line to revisit.
   */
  if (!byHand) return true

  await rewriteSourceAsset(document, io, wasEdited, draft)
  // The folder now holds a file it did not: a document saved for the first time has to appear
  // in the Explorer without waiting for the panel to be reopened.
  void useDocuments.getState().relist('own-write')
  return true
}

/**
 * Which format overwriting the source means writing, and what it would destroy.
 *
 * A format the table does not write — a `.tif`, a `.gif` — is written as OpenRaster rather than
 * flattened: « no answer » must never read as « nothing to lose ».
 */
function writePlanFor(
  document: DocumentDescriptor,
  io: DocumentIo,
  sourceAssetId: string,
): { format: WritableFormat; losses: CapabilityTrait[] } {
  // `path`, NEVER `name`: a row's name is the STEM — `adoptFile` stores `stemOf(…)` — so reading
  // the format off it answered `null` for every asset a project actually holds, and a document
  // with two layers was then refused even by the `.ora` that could hold it.
  // `path`, NEVER `name`: a row's name is the STEM, so no asset a project holds has an extension
  // there — read off it, a document with two layers was refused even by the `.ora` holding it.
  const written =
    formatOfFile(assetsById(useAssets.getState()).get(sourceAssetId)?.path ?? '') ??
    // Never the flat default on an unknown extension: `replaceBytes` moves the extension with the
    // bytes, so guessing would turn a container this table failed to recognise into a PNG.
    'ora'
  if (!io.traitsOf) return { format: written, losses: [] }

  // Against what is actually WRITTEN, never against what the file was: answered otherwise, an
  // unknown extension asked whether to flatten into an `.ora`, which loses nothing at all.
  return { format: written, losses: lossesFor(io.traitsOf(document.id), written) }
}

/**
 * The second half of ⌘S: the asset the tab was opened from, brought back in line with it.
 *
 * AFTER the document, and the order is the guarantee — the document holds the layers and the
 * history, the asset only a flat picture, so writing the asset first and failing on the document
 * would leave a fresh tile in front of lost work. A failure here undoes nothing and does not mark
 * the document dirty: it is journaled, remembered in `assetBehind`, and the next ⌘S retries it.
 *
 * Nothing at all for a document that edits no asset, for a kind whose `writeAsset` is absent —
 * every refusal in `IO_BY_KIND` says why at its own line — or for a tab nobody touched whose
 * asset is not already behind.
 */
async function rewriteSourceAsset(
  document: DocumentDescriptor,
  io: DocumentIo,
  wasEdited: boolean,
  captured: CapturedDraft,
): Promise<void> {
  const source = document.sourceAssetId
  if (!source || !io.writeAsset) return
  // An edit to carry over, or one that never made it: both are a reason to write the asset.
  if (!wasEdited && !assetBehind.has(document.id)) return

  // Against what the source file IS. A `.ora` holds the whole stack, so the same document that
  // cannot be written back to a `.png` writes back to it whole — which is what makes an open
  // format worth reaching for rather than a second place to keep the same picture.
  const { format, losses } = writePlanFor(document, io, source)
  // ASKED, then said — never refused. The document was written a few lines above, into the `.ora`
  // that holds the whole stack, so the flat picture the asset receives costs nothing: it is the
  // RENDER the scene and the shelf read, not the copy the work lives in. Refusing left the two
  // out of step with no way back — a channel of a texture is always a `.png`, so any layer,
  // opacity or blend stopped a ⌘S from ever reaching the model.
  if (losses.length > 0 && !(await agreedToFlatten(document, format, losses))) return

  try {
    const written = await io.writeAsset(
      document.id,
      { replaces: source, name: document.title, format },
      captured,
    )
    // `null` is "nothing to bake yet" — an engine still bringing its GPU context up, which is
    // exactly when a ⌘S after switching workspace lands. Not a success, and not silent either:
    // treated as such it left every consumer of the asset on the pre-edit picture for good.
    if (!written) throw new Error('nothing to bake yet')

    assetBehind.delete(document.id)
    // The file now holds what the preview was standing in for. Revoked rather than left: two
    // answers for one asset is exactly the drift a preview must never become.
    useLivePreviews.getState().revokePreview(source)
    // The tile still holds the bitmap it decoded: only a fresh `localChangedAt` moves the URL
    // `posterUrl` builds, and without it the overwrite looks like a gesture that did nothing.
    //
    // `invalidate`, like every other site that says the catalogue changed: `assets.search` is a
    // synchronous SQLite query in the main process, and a held ⌘S would open one per keystroke
    // on the path of a shortcut.
    useAssets.getState().invalidate()
  } catch (error) {
    assetBehind.add(document.id)
    reportFailure('assets.save', document.title, error)
  }
}

/**
 * Writes a COPY of the asset beside the original, and carries the tab on with the copy.
 *
 * What ⌘⇧S means in every application: the file that was open stays as it was at the last save,
 * and the work continues on the new one. Here the file is an asset — `derivedFrom` keeps the two
 * traceable to each other, which a copy on disk could not say.
 *
 * The copy is NOT named by a dialog. The audio editor settled that first: its « save as new »
 * derives a name and the renaming happens in the inspector, so asking here would be a second way
 * to name an asset, next to a gesture that never asks.
 *
 * Its FORMAT is not asked either, and for the same reason: the copy takes the source's format
 * when that format holds the document, and OpenRaster when it does not. A menu of formats here
 * would be a second way to answer a question the document has already answered — and the one
 * choice it would add, flattening on purpose, is what Export is for.
 *
 * Answers whether anything was written, like `saveDocument` — a document that edits no asset has
 * nothing to copy, and says so in the journal rather than in silence.
 */
export async function saveDocumentAs(documentId: string): Promise<boolean> {
  const savable = savableDocument(documentId)
  if (!savable) return false
  const { bridge, document, io } = savable

  const source = document.sourceAssetId
  // No asset to derive from, or a kind that bakes to nothing one could hold: both are "there is
  // no copy to make", and both are said out loud rather than doing nothing quietly.
  if (!source || !io.writeAsset) {
    reportFailure('assets.copy', document.title, new Error('nothing to copy'))
    return false
  }

  const name = i18next.t('documents.copyName', { name: document.title })
  // The source's own format when it holds the document, OpenRaster when it does not: a copy of a
  // stack must not be the one write that flattens it.
  const { format, losses } = writePlanFor(document, io, source)

  try {
    // ONE capture for both, and it comes first: the copy and the document it belongs to have to be
    // the same picture, and an image's bytes come off the graphics card — asking twice doubles the
    // freeze AND lets a stroke made in between land in one of the two and not the other.
    const { draft } = await io.capture(documentId)
    const copy = await io.writeAsset(
      documentId,
      { derivedFrom: source, name, format: losses.length === 0 ? format : 'ora' },
      draft,
    )
    if (!copy) {
      reportFailure('assets.copy', document.title, new Error('nothing to bake yet'))
      return false
    }

    // The document SECOND, and pointed at the copy: the tab carries on with the new asset, and
    // the one that was open keeps whatever the last ⌘S left on it.
    const created = await useDocuments
      .getState()
      .create(document.workspace, { title: name, sourceAssetId: copy.id })

    // The asset is already on disk by now, so a failure past this point leaves it there with no
    // document naming it. Said out loud rather than swallowed: the copy is in the shelf, and a
    // user who cannot see why has no way to find that out.
    if (!created) {
      reportFailure('assets.copy', document.title, new Error('no document for the copy'))
      return false
    }

    await bridge.documents.write(
      created.id,
      created.kind,
      {
        ...draft,
        title: name,
        // The link, written like `saveDocument` writes it — without it the copy would come back
        // from disk knowing nothing of the asset it was made for.
        sourceAssetId: copy.id,
      },
      false,
      // Beside the document it copies, which is where `create` already put the descriptor.
      parentOf(created.path) ?? FOLDER_ROOT,
    )

    // NOT installed here, and `commit` is not called either. `install` would replace the state
    // before the copy's panel exists, so `IMAGE_IO` would find no engine to hand the pixels to
    // and drop them — and `holds` being true afterwards makes `restoreDocument` skip the read
    // that would have fixed it, leaving a blank tab the next ⌘S writes over the copy. `commit`
    // closes over the ORIGINAL id, and would clear the bullet of a tab nothing was written for.
    // Opening the tab reads the file that has just been written, which is the whole point.
    openDocument(created)

    await useAssets.getState().refresh()
    void useDocuments.getState().relist('own-write')
    return true
  } catch (error) {
    // Both sides of the write: the `try` OPENS on `writeAsset`, so a rejection there lands here
    // with nothing on disk, while `capture`, `create` and `refresh` land here with the copy
    // already written. That is why the sentence says the copy could not be FINISHED rather than
    // not be made — one of the four sites reports a copy that exists.
    reportFailure('assets.copy', document.title, error)
    return false
  }
}

/**
 * Reads in flight, so a panel that mounts twice reads once. React's StrictMode runs every mount
 * effect twice in development, and `DocumentArea` is keyed on the workspace — switching space
 * and back remounts every open document.
 */
const loading = new Map<string, Promise<void>>()

/**
 * Fills a document's tab on mount: from the project when a file is there, from the space's own
 * default otherwise. Idempotent — reopening a tab must not reset what is in it.
 *
 * A file that fails to read leaves the tab empty rather than taking the default, which a later
 * ⌘S would write over it. A document never saved reads `null` — not a failure, and it takes the
 * default like any new tab.
 */
export function restoreDocument(documentId: string): Promise<void> {
  const existing = loading.get(documentId)
  if (existing) return existing

  const bridge = getBridge()
  // A descriptor is what `ioOf` reads the kind from, so a missing one has already returned.
  const document = useDocuments.getState().documents[documentId]
  const io = ioOf(documentId)
  if (!io || io.holds(documentId)) return Promise.resolve()

  if (!bridge || !document) {
    io.createDefault(documentId)
    return Promise.resolve()
  }

  unreadable.delete(documentId)

  // Nothing is rethrown into a mount effect that has nowhere to show it — it is reported from
  // here instead, which is the one place that knows a read failed. Without that, the empty
  // editor a failed read leaves is indistinguishable from a new document, and the refusal to
  // save it then looks like a ⌘S that does nothing.
  const reading = bridge.documents
    .read(document.id, document.kind)
    .then(file => {
      // Re-checked after the await: the tab was live while the read was in flight, and the Add
      // menu acts on it. Overwriting that edit would also mark the document clean, leaving an
      // undo stack whose commands describe a scene that never existed.
      if (io.holds(documentId)) return
      if (file) io.install(documentId, file.content, file.parts)
      else io.createDefault(documentId)
    })
    .catch(error => {
      unreadable.add(documentId)
      reportFailure('document.load', document.title, error)
    })
    .finally(() => loading.delete(documentId))

  loading.set(documentId, reading)
  return reading
}

/**
 * Gives a freshly mounted engine back the pixels the document holds on disk.
 *
 * The companion of `restoreDocument`, and the two never both act: that one reads the file when
 * the state is MISSING, this one when the state is already there and the pixels are not. A
 * workspace switch rebuilds `DocumentArea` and every engine under it, so a document that stayed
 * open came back with its whole stack and nothing drawn in it.
 *
 * What was last SAVED, which is all there is: the textures went with the GPU context, so work
 * done since the last ⌘S is gone either way — this is what stops the rest from going with it.
 */
export async function rehydrateDocument(documentId: string): Promise<void> {
  const bridge = getBridge()
  const document = useDocuments.getState().documents[documentId]
  const io = ioOf(documentId)
  if (!bridge || !document || !io?.rehydrate) return
  // A document not yet filled belongs to `restoreDocument`; both reading would race two installs
  // onto the same tab. `unreadable` is the file that would not open, and it stays shut.
  if (!io.holds(documentId) || unreadable.has(documentId)) return

  try {
    const file = await bridge.documents.read(document.id, document.kind)
    if (file?.parts?.length) return io.rehydrate(documentId, file.content, file.parts)

    // No file of its own yet — a tab opened from a container and never saved. Its pixels are
    // still where they were read from, and only the container holds them layer by layer.
    if (document.sourceAssetId) await io.rehydrateFromAsset?.(documentId, document.sourceAssetId)
  } catch (error) {
    reportFailure('document.load', document.title, error)
  }
}

/** Whether closing would throw work away. A tab that never filled, or was never touched, has none. */
export function documentIsDirty(documentId: string): boolean {
  const io = ioOf(documentId)
  return io !== undefined && io.holds(documentId) && io.dirty(documentId)
}

/**
 * How many gestures are deciding a document's fate right now.
 *
 * A native dialog blocks the user's input, NOT the renderer's timers. With "Save / Don't Save"
 * on screen, a pass on a timer would write the very document the user is about to decline to
 * save — and "Don't Save" would then close the tab over work already on disk. Held for the whole
 * gesture rather than for the question alone: `settleUnsavedWork` collects every answer before
 * acting on any of them, so the window between an answer and what it means is wide.
 */
let settling = 0

async function whileSettling<T>(body: () => Promise<T>): Promise<T> {
  settling += 1
  try {
    return await body()
  } finally {
    settling -= 1
  }
}

/**
 * What the user wants done with a document's unsaved work. `cancel` when nothing answered —
 * the one default that loses nothing.
 */
async function askAboutUnsavedWork(documentId: string): Promise<CloseChoice> {
  const title = useDocuments.getState().documents[documentId]?.title ?? ''
  return (await getBridge()?.documents.confirmClose(title)) ?? 'cancel'
}

/**
 * Closes a document: asks about unsaved work, writes it if that is the answer, then drops its
 * state, its history and its tab. `false` when the user cancelled, which is the one answer that
 * leaves everything as it was.
 *
 * The order matters. The file is written before anything is forgotten — a save that fails must
 * not have already thrown the work away — and the question is asked before the write so that a
 * cancelled dialog costs nothing.
 */
export async function closeDocument(documentId: string): Promise<boolean> {
  return await whileSettling(async () => {
    if (documentIsDirty(documentId)) {
      const choice = await askAboutUnsavedWork(documentId)
      if (choice === 'cancel') return false
      // Left open unless the work actually reached the disk — a write that throws, and one that
      // is refused because the file would not read, both leave the tab exactly where it was.
      // Closing anyway would lose the work the dialog had just promised to keep.
      if (choice === 'save' && !(await saveDocument(documentId))) return false
    }

    forgetDocument(documentId)
    return true
  })
}

/** The documents whose work would go with the window. Empty when nothing is at stake. */
export function unsavedDocumentIds(): string[] {
  return Object.keys(useDocuments.getState().documents).filter(documentIsDirty)
}

/**
 * Writes every open document that has work in it, without asking anything of anyone.
 *
 * One after another rather than all at once: each save reads an editor's state back, and six
 * documents captured together would hold the frame for as long as the slowest of them.
 *
 * Neither a refusal nor a failure is reported. Autosave is a net nobody asked for, not a
 * gesture: a document whose file would not read, or which something else has written since, is
 * left for ⌘S to settle — and the tab keeps its bullet, which says the work is not on disk.
 */
export async function autosaveOpenDocuments(): Promise<void> {
  // A question about closing is on screen: writing now would answer it for the user.
  if (settling > 0) return

  let wrote = false

  for (const documentId of unsavedDocumentIds()) {
    if (ioOf(documentId)?.autosaves === false) continue

    // Per document, so a full disk on the first tab does not cost the other five their pass.
    // Silent by design: this is a net nobody asked for, and it must not put a message in front
    // of someone every thirty seconds. ⌘S reports for itself.
    try {
      wrote = (await saveDocument(documentId, false)) || wrote
    } catch {
      // Nothing: the tab keeps its bullet, which is what says the work is not on disk.
    }
  }

  // Once for the pass, not once per document: `relist` walks the folder reading a head per
  // entry, and `'own-write'` deliberately opts out of sharing a listing already in flight. Only
  // a document saved for the first time puts a file in the folder, but that is enough to owe
  // the Explorer one listing.
  if (wrote) void useDocuments.getState().relist('own-write')
}

/**
 * Asks about every document holding unsaved work, then acts on the answers — in that order, and
 * the order is the point.
 *
 * Cancelling the last question must leave the studio exactly as it was, so nothing is written and
 * nothing is dropped until every document has been answered for. Closing them as the answers came
 * in would have thrown away the documents answered before the one that cancelled.
 *
 * `false` when the user cancelled, or when a save refused — either way the window stays.
 */
export async function settleUnsavedWork(): Promise<boolean> {
  return await settleUnsaved(true)
}

/**
 * The same questions, for a gesture that may still not happen: a folder that has gone, a
 * creation the user turns down at the second dialog. Nothing is forgotten here — `refreshDocuments`
 * drops what the new project does not hold, and it only runs once the change actually landed.
 *
 * Forgetting here instead threw the work away for a switch that never took place.
 */
export async function settleUnsavedWorkForProjectChange(): Promise<boolean> {
  return await settleUnsaved(false)
}

async function settleUnsaved(andForget: boolean): Promise<boolean> {
  return await whileSettling(async () => {
    const answers: Array<{ documentId: string; choice: CloseChoice }> = []

    for (const documentId of unsavedDocumentIds()) {
      const choice = await askAboutUnsavedWork(documentId)
      // Nothing further is asked: the gesture is off, so the documents behind this one are not
      // even questioned, let alone touched.
      if (choice === 'cancel') return false
      answers.push({ documentId, choice })
    }

    for (const { documentId, choice } of answers) {
      // Same order as `closeDocument`: the file is written before anything is forgotten, so a
      // save that fails leaves the work where it was rather than having already dropped it.
      if (choice === 'save' && !(await saveDocument(documentId))) return false
      if (andForget) forgetDocument(documentId)
    }

    return true
  })
}

/**
 * Removes the document's file from the project, then closes its tab. Confirmed first, and by
 * the OS: this is the one gesture in the studio that destroys a file the user made.
 *
 * Unsaved work is not offered for saving on the way out — the file is going. Answering "save"
 * to a document about to be deleted would write it and delete it in the same breath.
 */
export async function deleteDocument(documentId: string): Promise<boolean> {
  const bridge = getBridge()
  const document = useDocuments.getState().documents[documentId]
  if (!bridge || !document) return false

  return (await bridge.documents.confirmDelete(document.title)) && dropDocument(documentId)
}

/**
 * The same removal with no question asked — for a caller that has already been answered.
 *
 * The assistant is that caller: its own gate stands in front of every `files` action, and it can
 * be delegated. A native dialog behind that gate would ask twice, and an MCP client on the other
 * side of the machine cannot answer the second one — the call would simply stand there.
 */
export async function dropDocument(documentId: string): Promise<boolean> {
  const bridge = getBridge()
  const document = useDocuments.getState().documents[documentId]
  if (!bridge || !document) return false

  await bridge.documents.remove(document.id, document.kind)
  forgetDocument(documentId)
  // The row has to go with the file. Left standing, a double-click on it would open an empty
  // document under the same id — and the next ⌘S would write back what was just deleted.
  void useDocuments.getState().relist('own-write')
  return true
}

/**
 * Reconciles the open tabs with the folder, and drops what that leaves behind.
 *
 * `refresh` settles which tabs survive by rewriting the store's map in one write — deliberately,
 * since closing them one by one would paint and unpaint every tab. Nothing it drops therefore
 * passes through `forgetDocument`, and the session views of a project being left outlived it.
 *
 * The two halves are one call so they cannot be dissociated: after the write nothing names the
 * documents that went, so whoever refreshes has to have read them first. Descriptors, not ids —
 * the kind is what says which `DocumentIo` holds a document's state, and it is read from the
 * very map the refresh has already emptied.
 */
export async function refreshDocuments(): Promise<boolean> {
  const wereOpen = Object.values(useDocuments.getState().documents)
  const answered = await useDocuments.getState().refresh()

  const { documents } = useDocuments.getState()
  for (const document of wereOpen) {
    if (!documents[document.id]) forgetDocument(document.id, document)
  }

  return answered
}

/**
 * Drops everything a document was holding, in the window and in the layout.
 *
 * Its refusal to save is dropped too: the id is the project folder's to hand out again, and a
 * document reopened later must not inherit the verdict passed on the one before it.
 *
 * `gone` is for the one caller whose document is already out of the store: without it nothing
 * names the kind that says which `DocumentIo` holds the state, nor the path a script is held by.
 *
 * 🛑 The id-only bookkeeping below runs either way — a document the store has lost still owes
 * its refusal, its asset and its session views.
 */
function forgetDocument(documentId: string, gone?: DocumentDescriptor): void {
  const document = gone ?? useDocuments.getState().documents[documentId]
  if (document) IO_BY_KIND[document.kind].forget(document)
  unreadable.delete(documentId)
  // Same reason: the id goes back to the folder, and a document reopened later must not inherit
  // a debt owed by the one before it.
  assetBehind.delete(documentId)
  // And the answer given about flattening it: another document under the same id never agreed.
  flattenAgreed.delete(documentId)
  // Session views are not the document's state, so no `DocumentIo` drops them. `useCanvasViews`
  // and `useSceneViews` still keep their entry for the session — they hold a viewport, which is
  // harmless to inherit; an inspected channel is not, it would reopen the tab on a flat map.
  // A sky's view is of the second kind: it carries a projection and the test objects, and a
  // fresh document opening onto the cross of its predecessor is not what was asked for.
  useMaterialViews.getState().forget(documentId)
  useSkyboxViews.getState().forget(documentId)
  // Of the same kind: a montage reopening with a clip monitor its predecessor had asked for is
  // not what the default says.
  useMonitorPair.getState().forgetMonitorPair(documentId)
  closePanel(documentId)
  useDocuments.getState().close(documentId)
}
