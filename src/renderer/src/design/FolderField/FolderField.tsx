import { mdiChevronDown, mdiFolderOutline } from '@mdi/js'
import { FOLDER_ROOT, folderTrail, nameOf } from '@shared/domain/folder'
import { cn } from '@/helpers/cn'
import { activation } from '@/helpers/activation'
import { HINT_BOTTOM, HINT_RIGHT } from '@/helpers/tooltip'
import { useFolderChildren } from '@/hooks/useFolderChildren'
import { useHoverFlyout } from '@/hooks/useHoverFlyout'
import { Flyout } from '../Flyout'
import { FolderCrumbs } from '../FolderCrumbs'
import { MenuRow } from '../MenuRow'
import { UiIcon } from '../UiIcon'
import { FIELD } from '../styles'
import { FolderFieldCreate } from './FolderFieldCreate'

export type FolderFieldProps = {
  /** The chosen folder, relative to the project. `FOLDER_ROOT` is the project folder itself. */
  value: string
  onChange: (folder: string) => void
  /** Goes on the line itself, so a visible `<label>` can name it — a button IS labelable. */
  id?: string
  /** The project's own name, which is what the root is called. Already translated. */
  rootName: string
  /**
   * Every word this field puts on screen, already translated: it draws what it is handed and
   * looks nothing up, the way every other field of `design/` does.
   */
  labels: {
    crumbs: string
    crumbHint: string
    hint: string
    enterHint: string
    empty: string
    /** Names the folder being browsed — `{{folder}}` is filled by the caller's own bundle. */
    newFolderIn: string
    newFolderName: string
    newFolderLabel: string
    create: string
    cancel: string
    folderTaken: string
    folderFailed: string
  }
}

/**
 * Where something goes in the project, picked the way every desktop file dialog picks it: ONE
 * folder at a time, its path written above it, its sub-folders listed below.
 *
 * The folder shown IS the folder chosen — walking into one picks it. That is what a tree could
 * not say: it drew every level at once and left "where am I" to be read off the indentation,
 * and a New-folder row at the bottom of it named no parent at all. macOS, Windows and GTK all
 * answer this question the same way, and none of them unfolds a tree to do it.
 */
export function FolderField({ value, onChange, id, rootName, labels }: FolderFieldProps) {
  const flyout = useHoverFlyout(2)
  const children = useFolderChildren(value)

  return (
    <div {...flyout.wrapProps}>
      <button
        type="button"
        id={id}
        {...flyout.triggerProps}
        {...activation(flyout.open)}
        {...HINT_BOTTOM(labels.hint)}
        className={cn(FIELD, 'flex w-full items-center gap-2 text-left')}
      >
        <UiIcon path={mdiFolderOutline} size={14} />
        <span className="min-w-0 flex-1 truncate">
          {folderTrail(value)
            .map(folder => (folder === FOLDER_ROOT ? rootName : nameOf(folder)))
            .join(' / ')}
        </span>
        <UiIcon path={mdiChevronDown} size={14} />
      </button>

      {flyout.showing && (
        <Flyout
          anchor={flyout.anchor}
          // A field's menu: under the line, on its left edge and at its width, the way a
          // `<select>` opens. `below` aligns RIGHT edges, which hung it off-centre.
          placement="under"
          {...flyout.flyoutProps}
        >
          {/* Where you ARE, first and in words. Every segment but the last walks back up. */}
          <FolderCrumbs
            folder={value}
            onPick={onChange}
            labels={{ nav: labels.crumbs, projectFolder: rootName, hint: labels.crumbHint }}
            tip={HINT_RIGHT}
            className="border-border border-b"
          />

          {children.entries.map(entry => (
            <MenuRow
              key={entry.path}
              label={entry.name}
              icon={mdiFolderOutline}
              tip={HINT_RIGHT(labels.enterHint)}
              onSelect={() => onChange(entry.path)}
            />
          ))}

          {/* Said rather than left blank: an empty list and a list still loading look alike, and
              a menu that shows nothing at all reads as broken. */}
          {children.read && children.entries.length === 0 && (
            <p className="text-muted m-0 px-2 py-1.5 text-xs">{labels.empty}</p>
          )}

          <FolderFieldCreate
            folder={value}
            labels={labels}
            onCreated={onChange}
            onReread={children.reread}
          />
        </Flyout>
      )}
    </div>
  )
}
