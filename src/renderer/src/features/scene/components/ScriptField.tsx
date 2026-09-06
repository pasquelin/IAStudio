import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { refFromString } from '@shared/domain/ref'
import { LinkField } from '@/components/LinkField/LinkField'
import type { LinkOption } from '@/components/LinkField/linkOption'
import { openDocumentById } from '@/helpers/openAsset'
import { codeFilesOf, useCode } from '@/stores/code'
import { documentAtPath, useDocuments } from '@/stores/documents'

export type ScriptFieldProps = {
  label: string
  value: string
  onChange: (script: string) => void
  scId?: string
}

/**
 * The script a component runs, chosen from the project's own — the row a texture and a typeface
 * are chosen by, so the panel says « a file » the same way everywhere.
 *
 * A script the component names and the project no longer holds is offered all the same, marked
 * as missing: dropping it from the list would rewrite the component on the first edit, which is
 * the one thing a missing link must not do — see `FontField`, which holds the same line.
 */
export function ScriptField({ label, value, onChange, scId }: ScriptFieldProps) {
  const { t } = useTranslation()
  // 🛑 The RAW record, sorted under a memo: `codeFilesOf` builds a new array per call, and a
  // selector that does re-renders for ever — React tells you the snapshot is not cached.
  const files = useCode(state => state.files)
  const documents = useDocuments(state => state)

  const options = useMemo<LinkOption[]>(() => {
    const held = codeFilesOf({ files }).map(file => ({
      id: file.script,
      name: nameOf(file.script),
    }))
    const known = value === '' || held.some(one => one.id === value)
    return known
      ? held
      : [...held, { id: value, name: t('inspector.scriptMissing', { name: nameOf(value) }) }]
  }, [files, value, t])

  const open = pathOf(value) === null ? null : documentAtPath(documents, pathOf(value) ?? '')

  return (
    <LinkField
      label={label}
      value={value === '' ? null : value}
      options={options}
      onChange={id => onChange(id ?? '')}
      emptyLabel={t('inspector.scriptNone')}
      missingLabel={t('inspector.noScriptOffered')}
      clearLabel={t('inspector.clearScript')}
      clearHint={t('inspector.clearScriptHint')}
      open={
        open
          ? {
              label: t('inspector.openScript'),
              hint: t('inspector.openScriptHint'),
              run: () => openDocumentById(open.id),
            }
          : undefined
      }
      scId={scId}
    />
  )
}

/** What a `script:` reference names on disk, or nothing when the value is not one. */
function pathOf(value: string): string | null {
  const ref = refFromString(value)
  return ref?.kind === 'script' ? ref.path : null
}

/** The file's own name, folders left out: the row is narrow and the path is what the menu holds. */
function nameOf(value: string): string {
  const path = pathOf(value) ?? value
  return path.slice(path.lastIndexOf('/') + 1)
}
