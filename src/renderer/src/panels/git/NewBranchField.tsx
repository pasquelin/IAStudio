import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { isBranchName } from '@shared/domain/git'
import { FIELD_FILL } from '@/design/styles'
import { useGit } from '@/stores/git'

/**
 * Naming a branch, in the place the branch is read from.
 *
 * A field rather than a dialogue, and the reason is what a branch IS here: a way of trying
 * something without losing where you were. A modal window over the whole studio to type six
 * characters would make it feel like a decision.
 *
 * The name is checked before the command runs — `isBranchName` — because git's own refusal is a
 * `check-ref-format` message written for someone reading a manual page. What gets past is still
 * refused by git, and answered as a failure like any other.
 */
export function NewBranchField({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const createBranch = useGit(state => state.createBranch)

  const create = (): void => {
    if (!isBranchName(name)) return

    void createBranch(name)
    onDone()
  }

  return (
    <input
      // Focused on sight: the field replaced the button that was just clicked, and asking for a
      // second click to type into what one asked for reads as the gesture having failed.
      autoFocus
      type="text"
      value={name}
      aria-label={t('git.newBranch')}
      placeholder={t('git.newBranchPlaceholder')}
      className={FIELD_FILL}
      onChange={event => setName(event.target.value)}
      onKeyDown={event => {
        if (event.key === 'Enter') create()
        if (event.key === 'Escape') onDone()
      }}
      // Leaving the field is a decision too, and it is the one nobody makes on purpose: a click
      // elsewhere abandons rather than creates, so a half-typed name never becomes a branch.
      onBlur={onDone}
    />
  )
}
