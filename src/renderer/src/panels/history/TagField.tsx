import { mdiTagOutline } from '@mdi/js'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { isBranchName } from '@shared/domain/git'
import { ToolButton } from '@/design/ToolButton'
import { FIELD_FILL } from '@/design/styles'
import { TIP_LEFT } from '@/helpers/tooltip'
import { useGit } from '@/stores/git'

/**
 * Naming a version so it can be found again.
 *
 * What a tag is FOR here: the state a client saw, the one that went to print, the one before an
 * idea that did not work. A hash is what git calls a version and a name is what a person does,
 * and scrolling a history looking for `a3f9c1e` is what this exists to replace.
 *
 * The same check a branch name gets, for the same reason: a tag reaches `git tag` as an argument.
 */
export function TagField({ commit }: { commit: string }) {
  const { t } = useTranslation()
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  const busy = useGit(state => state.busy)
  const tag = useGit(state => state.tag)

  if (!naming) {
    return (
      <ToolButton
        icon={mdiTagOutline}
        label={t('git.tagVersion')}
        description={t('git.tagVersionHint')}
        tooltip={TIP_LEFT}
        variant="row"
        disabled={busy}
        onClick={() => setNaming(true)}
      />
    )
  }

  return (
    <input
      autoFocus
      type="text"
      value={name}
      aria-label={t('git.tagVersion')}
      placeholder={t('git.tagPlaceholder')}
      className={FIELD_FILL}
      onChange={event => setName(event.target.value)}
      onKeyDown={event => {
        if (event.key === 'Enter' && isBranchName(name)) {
          void tag(name, commit)
          setNaming(false)
          setName('')
        }
        if (event.key === 'Escape') setNaming(false)
      }}
      // Leaving abandons rather than tags: a half-typed name never becomes a name in the history.
      onBlur={() => setNaming(false)}
    />
  )
}
