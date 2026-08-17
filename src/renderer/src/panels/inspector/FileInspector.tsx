import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Asset } from '@shared/domain/asset'
import type { DocumentDescriptor } from '@shared/domain/document'
import { PropertyGroup } from '@/design/PropertyGroup'
import { PropertyRow } from '@/design/PropertyRow'
import { assetsAt } from '@/helpers/asset-at'
import { formatBytes } from '@/helpers/format'
import { itemOfPath, type ProjectItem } from '@/helpers/project-item'
import { useDocuments } from '@/stores/documents'
import { RoleField } from './RoleField'
import { SelectionSummary } from './SelectionSummary'

/**
 * A file picked in the explorer, read out.
 *
 * The explorer holds PATHS, and a path alone says almost nothing: what the file is called, what
 * the studio makes of it, whether the catalogue holds a row for it. The three answers come from
 * one place — `itemOfPath` — so this face and the domain view can never disagree about a file.
 *
 * Several at once are summarised rather than detailed, exactly as a selection of assets is:
 * showing the first one's role for a selection of twelve is how someone corrects the wrong file.
 */
export function FileInspector({ paths }: { paths: readonly string[] }) {
  const { t, i18n } = useTranslation()
  const stored = useDocuments(state => state.stored)
  const [assets, setAssets] = useState<Map<string, Asset>>(new Map())

  // One round trip for the whole selection: the catalogue is the project's own database, read in
  // the process that owns every window.
  useEffect(() => {
    let live = true
    void assetsAt(paths).then(found => {
      if (live) setAssets(found)
    })
    return () => {
      live = false
    }
  }, [paths])

  // Keyed by the path the descriptor was read from — the same reading the explorer's rows are
  // drawn from, and the same spelling the selection carries.
  const documentOf = (path: string): DocumentDescriptor | null =>
    stored.find(document => document.path === path) ?? null

  const items: ProjectItem[] = paths.map(path =>
    itemOfPath(path, { asset: assets.get(path), document: documentOf(path) }),
  )

  const [only] = items
  if (items.length > 1 || !only) {
    // The same summary the shelf's own face gives, size included: the two answer one question,
    // and the catalogue holds the bytes of whichever of these files it knows.
    const total = items.reduce((bytes, item) => bytes + (item.bytes ?? 0), 0)
    return <SelectionSummary count={items.length} bytes={total} />
  }

  return (
    <PropertyGroup title={t('inspector.identity')}>
      <PropertyRow label={t('inspector.name')}>{only.name}</PropertyRow>
      {/* Stacked: a path is the one value here that has no chance of fitting a column. */}
      <PropertyRow label={t('inspector.path')} stacked>
        {only.path}
      </PropertyRow>
      <RoleField assetId={only.assetId} domain={only.domain} />
      {only.bytes !== null && (
        <PropertyRow label={t('inspector.size')}>
          {formatBytes(only.bytes, unit => t(`units.${unit}`), i18n.language)}
        </PropertyRow>
      )}
    </PropertyGroup>
  )
}
