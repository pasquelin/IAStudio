import { mdiPlus, mdiSourceBranch } from '@mdi/js'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { isRefName, type GitBranch, type GitStatus } from '@shared/domain/git'
import { MenuButton } from '@/design/MenuButton'
import { MenuRow } from '@/design/MenuRow'
import { NameField } from '@/design/NameField'
import { HINT_LEFT, TIP_BOTTOM } from '@/helpers/tooltip'
import { useGit } from '@/stores/git'

/**
 * Which branch is out, and the way to any other. Re-read on every open: a branch made in a
 * terminal moves neither the head nor the current branch, so nothing else would ask for it.
 */
export function GitBranchButton({ status }: { status: GitStatus }) {
  const { t } = useTranslation()
  const [branches, setBranches] = useState<readonly GitBranch[]>([])
  const [naming, setNaming] = useState(false)
  const listBranches = useGit(state => state.branches)
  const checkout = useGit(state => state.checkout)
  const createBranch = useGit(state => state.createBranch)
  const busy = useGit(state => state.busy)

  const reload = useCallback(() => {
    void listBranches().then(setBranches)
  }, [listBranches])

  // On mount too, and not only on open: the count decides whether the button opens a menu at all,
  // so a button that had never read would send the first click to naming. Keyed on the head as
  // well, a commit being able to be the only thing that moved.
  useEffect(reload, [reload, status.branch, status.head])

  if (naming) {
    return (
      <NameField
        label={t('git.newBranch')}
        placeholder={t('git.newBranchPlaceholder')}
        accepts={isRefName}
        scId="git.newBranchName"
        onSubmit={name => {
          void createBranch(name)
          setNaming(false)
        }}
        onCancel={() => setNaming(false)}
      />
    )
  }

  return (
    <MenuButton
      icon={mdiSourceBranch}
      // The accessible name IS the visible text below: `ToolButton` names itself from `label`,
      // and a name not containing what the eye reads breaks WCAG 2.5.3.
      label={status.branch ?? t('git.detached')}
      description={t('git.branchHint')}
      tooltip={TIP_BOTTOM}
      variant="header"
      // `ToolButton` is square by gauge, and `shrink-0`: a label needs the width back, and a
      // long branch name needs permission to give ground before `truncate` does anything.
      // `ActivityList` undoes the same three for the same reason.
      className="w-auto min-w-0 shrink gap-2 px-1.5"
      /**
       * A repository with no first commit lists NO branch — git has none until something is
       * recorded — so the menu would hold the single row that makes one. `MenuButton` treats one
       * row as no menu at all and leaves the button to act directly, which is right: the click
       * goes straight to the field rather than opening a list of one.
       */
      opensOnClick={branches.length > 0}
      onClick={() => {
        if (branches.length === 0) setNaming(true)
      }}
      onShow={reload}
      rowCount={branches.length + 1}
      rows={close => (
        <>
          {branches.map(branch => (
            <MenuRow
              key={branch.name}
              label={branch.name}
              checked={branch.current}
              tick="one-of"
              disabled={busy}
              tip={HINT_LEFT(t('git.checkoutHint'))}
              onSelect={() => {
                close()
                if (!branch.current) void checkout(branch.name)
              }}
            />
          ))}
          <MenuRow
            label={t('git.newBranch')}
            icon={mdiPlus}
            disabled={busy}
            tip={HINT_LEFT(t('git.newBranchHint'))}
            onSelect={() => {
              close()
              setNaming(true)
            }}
          />
        </>
      )}
    >
      <span className="min-w-0 truncate text-xs">{status.branch ?? t('git.detached')}</span>
    </MenuButton>
  )
}
