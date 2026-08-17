import { mdiTextureBox } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/design/EmptyState'
import { activeTextureId, useDocuments } from '@/stores/documents'
import { ChannelsGrid } from './ChannelsGrid'

/**
 * The eight channels a material is made of, each one a tile.
 *
 * A grid rather than the strip the brief drew: it lives in the right column, where what speaks
 * about the document lives, so the eight wrap instead of running across a band the asset shelf
 * already owns — and a channel and the shelf you drag onto it stay on screen together.
 */
export function Channels() {
  const { t } = useTranslation()
  const documentId = useDocuments(activeTextureId)

  return documentId ? (
    // Keyed: the derivation in flight is the grid's own state, and one instance shared across
    // documents left every derivable row of the texture in front dead for a job running in
    // another tab — with a reason that was true of a document nobody was looking at.
    <ChannelsGrid key={documentId} documentId={documentId} />
  ) : (
    <EmptyState icon={mdiTextureBox} message={t('texture.noDocument')} />
  )
}
