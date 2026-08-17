import { mdiPackageDown, mdiTrayArrowDown, mdiTrayArrowUp } from '@mdi/js'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { GitStashEntry, GitStatus } from '@shared/domain/git'
import { hasChanges } from '@shared/domain/git'
import { MenuButton } from '@/design/MenuButton'
import { MenuRow } from '@/design/MenuRow'
import { HINT_LEFT, TIP_BOTTOM } from '@/helpers/tooltip'
import { useGit } from '@/stores/git'

/**
 * Setting work aside, and taking it back.
 *
 * What it is FOR in a studio: a lighting attempt one wants out of the way to look at the version
 * underneath, without recording it and without losing it. The message is the moment, not a title
 * — so it is stamped from what the branch was, and nothing is asked of the user.
 *
 * Popping rather than applying: bringing a pile back and leaving it on the stack is two gestures
 * where everybody means one, and the copy left behind is the one nobody remembers to drop.
 */
export function StashButton({ status }: { status: GitStatus }) {
  const { t } = useTranslation()
  const [piles, setPiles] = useState<readonly GitStashEntry[]>([])
  const busy = useGit(state => state.busy)
  const stashes = useGit(state => state.stashes)
  const stash = useGit(state => state.stash)
  const stashPop = useGit(state => state.stashPop)
  const stashDrop = useGit(state => state.stashDrop)

  // What is on the stack changes with every push and pop, and both of those take files out of the
  // working tree or put them back. Keyed on the PATHS rather than on the array: the IPC clone
  // rebuilds it on every refresh, so the array itself is a new identity several times a minute
  // and this ran `git stash list` on each of them. Staging a file leaves the paths alone too.
  const paths = status.files.map(file => file.path).join('\n')

  useEffect(() => {
    void stashes().then(setPiles)
  }, [stashes, paths, status.head])

  const setAside = (): void => {
    void stash(t('git.stashOf', { branch: status.branch ?? t('git.detached') }))
  }

  return (
    <MenuButton
      icon={mdiPackageDown}
      label={t('git.stash')}
      description={t('git.stashHint')}
      tooltip={TIP_BOTTOM}
      variant="header"
      // With nothing on the stack the menu would hold the one row that fills it, so the click
      // does that outright — `MenuButton` treats a single row as no menu at all.
      opensOnClick={piles.length > 0}
      onClick={() => {
        if (piles.length === 0 && hasChanges(status)) setAside()
      }}
      disabled={busy || (piles.length === 0 && !hasChanges(status))}
      rowCount={piles.length * 2 + 1}
      rows={close => (
        <>
          <MenuRow
            label={t('git.stashNow')}
            icon={mdiTrayArrowDown}
            disabled={busy || !hasChanges(status)}
            tip={HINT_LEFT(t('git.stashNowHint'))}
            onSelect={() => {
              close()
              setAside()
            }}
          />

          {piles.map(pile => (
            <MenuRow
              key={pile.index}
              label={pile.message}
              icon={mdiTrayArrowUp}
              disabled={busy}
              tip={HINT_LEFT(t('git.stashPopHint'))}
              onSelect={() => {
                close()
                void stashPop(pile.index)
              }}
            />
          ))}

          {piles.map(pile => (
            <MenuRow
              key={`drop-${pile.index}`}
              label={t('git.stashDrop', { name: pile.message })}
              disabled={busy}
              tip={HINT_LEFT(t('git.stashDropHint'))}
              onSelect={() => {
                close()
                void stashDrop(pile.index)
              }}
            />
          ))}
        </>
      )}
    />
  )
}
