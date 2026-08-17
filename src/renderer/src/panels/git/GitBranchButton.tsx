import { mdiPlus, mdiSourceBranch } from '@mdi/js'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { isRefName, type GitBranch, type GitStatus } from '@shared/domain/git'
import { MenuButton } from '@/design/MenuButton'
import { MenuRow } from '@/design/MenuRow'
import { NameField } from '@/design/NameField'
import { HINT_LEFT, TIP_BOTTOM } from '@/helpers/tooltip'
import { useGit } from '@/stores/git'

/**
 * Which branch is out, and the way to any other.
 *
 * The list is read when the menu OPENS rather than with every status: it is a command of its own,
 * and the branches of a project change far less often than its files do. Re-read on each open, so
 * one made in a terminal is there the next time the menu is pulled down.
 */
export function GitBranchButton({ status }: { status: GitStatus }) {
  const { t } = useTranslation()
  const [branches, setBranches] = useState<readonly GitBranch[]>([])
  const [naming, setNaming] = useState(false)
  const listBranches = useGit(state => state.branches)
  const checkout = useGit(state => state.checkout)
  const createBranch = useGit(state => state.createBranch)
  const busy = useGit(state => state.busy)

  // Keyed on the head as well as the branch: a commit can be the only thing that changed, and
  // the list carries what each branch points at once the remote arrives.
  useEffect(() => {
    void listBranches().then(setBranches)
  }, [listBranches, status.branch, status.head])

  if (naming) {
    return (
      <NameField
        label={t('git.newBranch')}
        placeholder={t('git.newBranchPlaceholder')}
        accepts={isRefName}
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
