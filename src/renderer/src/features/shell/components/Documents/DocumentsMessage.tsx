import { mdiFileOutline } from '@mdi/js'
import { EmptyState } from '@/components/EmptyState'

/**
 * What a document tab says instead of a document — none open, one still loading, one whose
 * document the restored layout outlived. Three sentences, one glyph: they differ in what they
 * say and in nothing else, and three copies of the icon is three ways for them to drift apart.
 */
export function DocumentsMessage({ message }: { message: string }) {
  return <EmptyState icon={mdiFileOutline} message={message} />
}
