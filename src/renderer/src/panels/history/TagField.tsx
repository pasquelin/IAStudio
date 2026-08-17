import { mdiTagOutline } from '@mdi/js'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { isRefName } from '@shared/domain/git'
import { NameField } from '@/design/NameField'
import { ToolButton } from '@/design/ToolButton'
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
    <NameField
      label={t('git.tagVersion')}
      placeholder={t('git.tagPlaceholder')}
      accepts={isRefName}
      disabled={busy}
      onSubmit={name => {
        void tag(name, commit)
        setNaming(false)
      }}
      onCancel={() => setNaming(false)}
    />
  )
}
