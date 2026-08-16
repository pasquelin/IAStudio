import { memo, useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { checkDocumentName } from '@shared/domain/document-name'
import { Button } from '@/design/Button'
import { FIELD } from '@/design/styles'
import { cn } from '@/helpers/cn'
import { isComposing } from '@/helpers/composition'
import {
  DOCUMENT_NAME_REFUSALS,
  registerDocumentNamer,
  type DocumentNameRequest,
  type DocumentNamer,
} from './document-name'

type Asked = { request: DocumentNameRequest; answer: (name: string | null) => void }

/**
 * What a document is called, asked before it is made.
 *
 * The studio used to name them itself — « Sans titre 3 » — and a project of six documents read
 * as a list of numbers. The field opens on that same name, selected: Enter takes it as it stands,
 * typing replaces it, so naming costs nothing to whoever does not care to.
 *
 * Refused where it is typed rather than at the disk. A name the folder already holds would be
 * quietly suffixed by the first save, and a document called something its author did not write
 * is the one outcome worth a dialog.
 */
export const DocumentNameDialog = memo(function DocumentNameDialog() {
  const { t } = useTranslation()
  const [asked, setAsked] = useState<Asked | null>(null)
  const [draft, setDraft] = useState('')
  const field = useRef<HTMLInputElement>(null)
  /**
   * Whether a question is already up, for `namer` — a closure fixed at mount, which cannot see
   * the state. The state is what the field is drawn from; this is only ever read.
   */
  const pending = useRef<Asked | null>(null)
  const titleId = useId()
  const refusalId = useId()

  const namer = useCallback<DocumentNamer>(
    request =>
      new Promise(answer => {
        // One at a time, and the second is refused rather than shown: the first is on screen with
        // a caret in it, and answering it for the newcomer would make a document nobody named.
        if (pending.current) {
          answer(null)
          return
        }

        const question = { request, answer }
        pending.current = question
        setAsked(question)
        setDraft(request.suggested)
      }),
    [],
  )

  useEffect(() => registerDocumentNamer(namer), [namer])

  useEffect(() => {
    if (!asked) return

    field.current?.focus()
    // And the whole name with it: the field opens on a name that is there to be replaced.
    field.current?.select()
  }, [asked])

  if (!asked) return null

  // Reached from the field alone, which the early return above puts behind a live question.
  const settle = (name: string | null): void => {
    pending.current = null
    setAsked(null)
    asked.answer(name)
  }

  const refusal = checkDocumentName(draft, asked.request.kind, asked.request.taken)

  /**
   * Escape here rather than through `useDismiss`, which the floating surfaces use: it also
   * dismisses on `window` blur — leaving for a reference image would throw away a half-typed
   * name — and it listens on `document`, so one press would close the assistant underneath at
   * the same time. A field one is typing in is dismissed by hand, not by wandering off.
   */
  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    // Stopped here: the surfaces behind bind bare letters, and typing a name must not arm a tool.
    event.stopPropagation()
    // Escape cancels the candidate an input method is composing — see `isComposing`.
    if (event.key === 'Escape' && !isComposing(event)) settle(null)
  }

  return (
    <div className="bg-scrim fixed inset-0 z-60 flex items-center justify-center p-8">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          'border-border bg-surface flex w-full max-w-sm flex-col gap-3',
          'rounded-(--radius-sc-lg) border p-4 shadow-(--sc-shadow-floating)',
        )}
      >
        <h2 id={titleId} className="text-text m-0 text-sm font-medium">
          {t('documents.new')}
        </h2>

        <form
          className="flex flex-col gap-3"
          onKeyDown={onKeyDown}
          onSubmit={event => {
            event.preventDefault()
            if (!refusal) settle(draft.trim())
          }}
        >
          <input
            ref={field}
            aria-label={t('documents.renameLabel')}
            aria-describedby={refusal ? refusalId : undefined}
            value={draft}
            className={cn(FIELD, 'w-full text-xs')}
            onChange={event => setDraft(event.target.value)}
          />

          {refusal && (
            <p id={refusalId} role="alert" className="text-warning m-0 text-xs">
              {t(DOCUMENT_NAME_REFUSALS[refusal])}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button onClick={() => settle(null)}>{t('documents.cancel')}</Button>
            <Button type="submit" variant="primary" disabled={refusal !== null}>
              {t('documents.create')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
})
