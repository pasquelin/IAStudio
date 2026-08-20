import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { EXTENSIONS_BY_KIND } from '@shared/domain/document'
import { checkDocumentName } from '@shared/domain/documentName'
import { FOLDER_ROOT } from '@shared/domain/folder'
import type { NamedDocumentPlace, NewDocumentAsk } from '@shared/domain/newDocument'
import { DEFAULT_SCENE_TEMPLATE, type SceneTemplateId } from '@shared/domain/sceneTemplate'
import { Button } from '@/design/Button'
import { FolderPicker } from '@/design/FolderPicker/FolderPicker'
import { WindowShell } from '@/design/WindowShell'
import { FIELD_FILL, FILE_EXTENSION } from '@/design/styles'
import { cn } from '@/helpers/cn'
import { isComposing } from '@/helpers/composition'
import { getBridge } from '@/services/bridge'
import { useAppliedSettings } from '@/hooks/useAppliedSettings'
import { takenDocumentNames, useDocuments } from '@/stores/documents'
import { DOCUMENT_NAME_REFUSALS } from '../documentName'
import { NewDocumentTemplates } from './NewDocumentTemplates'

/**
 * What a document is called and where it goes, asked in a WINDOW before it is made.
 *
 * A window rather than a modal over the studio: it is moved, resized and put beside what one is
 * looking at, and closing it means the document was not made — the studio is held on the other
 * end until this answers, and the main process answers `null` for a window that went away.
 *
 * The field opens on the name the studio would have given, selected: Enter takes it as it
 * stands, typing replaces it, so naming costs nothing to whoever does not care to.
 *
 * Refused where it is TYPED rather than at the disk, and the refusal follows the folder: a name
 * taken in one is free in the next. What each folder holds is read here — `stored` is the whole
 * project folder — plus the documents a tab holds and no file does yet, which travel in the ask.
 */
export function NewDocumentWindow() {
  const { t } = useTranslation()
  useAppliedSettings()

  const [ask, setAsk] = useState<NewDocumentAsk | null>(null)
  const [draft, setDraft] = useState('')
  const [folder, setFolder] = useState(FOLDER_ROOT)
  const [template, setTemplate] = useState<SceneTemplateId>(DEFAULT_SCENE_TEMPLATE)
  const stored = useDocuments(state => state.stored)
  const field = useRef<HTMLInputElement>(null)
  const nameId = useId()
  const extensionId = useId()
  const folderId = useId()
  const refusalId = useId()

  useEffect(() => {
    void (async () => {
      const asked = (await getBridge()?.newDocument.request()) ?? null
      if (!asked) return

      // The listing FIRST, and the form only then: what the folders hold is what a typed name is
      // refused against, and a field open over an empty listing accepts a name the disk already
      // holds — which the first save would silently suffix, the one outcome this window exists
      // to prevent. Read here rather than handed over: the picker walks the whole project.
      await useDocuments.getState().relist()

      setAsk(asked)
      setDraft(asked.suggested)
      setFolder(asked.folder)
    })()
  }, [])

  useEffect(() => {
    if (!ask) return

    field.current?.focus()
    // And the whole name with it: the field opens on a name that is there to be replaced.
    field.current?.select()
  }, [ask])

  /**
   * The main process is what closes this window, so a refused answer leaves it standing — and
   * standing is the right fallback: closing it by hand says exactly what Cancel says.
   */
  const settle = (place: NamedDocumentPlace | null): void => {
    void getBridge()
      ?.newDocument.answer(place)
      .catch(() => {})
  }

  // Nothing was asked — a window restored by the system, or one whose question has been settled.
  if (!ask) return <WindowShell title={t('documents.new')}>{null}</WindowShell>

  const refusal = checkDocumentName(
    draft,
    ask.kind,
    takenDocumentNames({ documents: {}, stored: [...stored, ...ask.open] }, folder),
  )

  /** Escape closes the window the way its close button does: nothing is made. */
  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    // Escape cancels the candidate an input method is composing — see `isComposing`.
    if (event.key === 'Escape' && !isComposing(event)) settle(null)
  }

  return (
    <WindowShell title={t(`documents.newByKind.${ask.kind}`)}>
      <form
        // The whole window: the name at the top, the browser taking the slack, the buttons at
        // the bottom edge wherever that edge is.
        className="flex h-full flex-col gap-3"
        onKeyDown={onKeyDown}
        onSubmit={event => {
          event.preventDefault()
          // The template travels for a scene and for nothing else: a kind that drew no section
          // would be answering with a choice nobody was offered.
          if (!refusal)
            settle({
              title: draft.trim(),
              folder,
              ...(ask.kind === 'scene' ? { template } : {}),
            })
        }}
      >
        {/* Labelled where it shows, not by an `aria-label`: two bare fields under one heading
              leave nothing to tell them apart, for a reader of either kind. */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor={nameId} className="text-muted text-xs">
            {t('documents.nameField')}
          </label>
          <div className="flex items-center gap-2">
            <input
              ref={field}
              data-sc="field:newDocument.name"
              id={nameId}
              aria-describedby={refusal ? `${extensionId} ${refusalId}` : extensionId}
              value={draft}
              className={cn(FIELD_FILL, 'text-xs')}
              onChange={event => setDraft(event.target.value)}
            />
            {/* Read off the kind, and shown rather than offered: one format per kind is the
                  whole of the open-format decision, so there is nothing here to pick between. */}
            <span id={extensionId} className={cn(FILE_EXTENSION, 'shrink-0 text-xs')}>
              {EXTENSIONS_BY_KIND[ask.kind]}
            </span>
          </div>
        </div>

        {refusal && (
          <p id={refusalId} role="alert" className="text-warning m-0 text-xs">
            {t(DOCUMENT_NAME_REFUSALS[refusal])}
          </p>
        )}

        {/* Under the name and above the folder, which is the order the questions come in: what it
            is called, what it holds, where it goes. */}
        {ask.kind === 'scene' && (
          <div className="flex flex-col gap-1.5">
            <span className="text-muted text-xs">{t('documents.templateField')}</span>
            <NewDocumentTemplates value={template} onChange={setTemplate} />
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col gap-1.5">
          <span id={folderId} className="text-muted text-xs">
            {t('documents.folderField')}
          </span>
          <FolderPicker
            value={folder}
            onChange={setFolder}
            rootName={ask.projectName}
            labels={{
              columns: t('documents.folderField'),
              empty: t('documents.folderEmpty'),
              newFolder: t('documents.newFolder'),
              newFolderName: t('documents.newFolderName'),
              newFolderLabel: t('documents.newFolderLabel'),
              create: t('documents.create'),
              cancel: t('documents.cancel'),
              folderTaken: t('documents.folderTaken'),
              folderFailed: t('documents.folderFailed'),
            }}
            // Handed to the picker rather than drawn under it: the three buttons belong on one
            // line, and only the picker knows when its own field has taken that line over.
            actions={
              <>
                <Button className="shrink-0" onClick={() => settle(null)}>
                  {t('documents.cancel')}
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  className="shrink-0"
                  disabled={refusal !== null}
                >
                  {t('documents.create')}
                </Button>
              </>
            }
          />
        </div>
      </form>
    </WindowShell>
  )
}
