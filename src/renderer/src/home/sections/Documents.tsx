import { useTranslation } from 'react-i18next'
import type { DocumentDescriptor } from '@shared/domain/document'
import { homeSectionLimit } from '@shared/domain/home'
import { Carousel } from '@/design/Carousel'
import { WORKSPACES, workspaceLabelKey } from '@/helpers/workspaces'
import { useDocuments } from '@/stores/documents'
import { useSettings } from '@/stores/settings'
import { openDocument } from '@/app/dockview-api'
import { Section } from '../Section'
import { ShelfCard, SHELF_CARD_HEIGHT } from '../ShelfCard'

const CARD_WIDTH = 190

function iconOf(document: DocumentDescriptor): string {
  return WORKSPACES.find(workspace => workspace.id === document.workspace)?.icon ?? ''
}

/** What is already open in this project, one click from being in front again. */
export function Documents() {
  const { t } = useTranslation()
  const documents = useDocuments(state => state.documents)
  const sections = useSettings(state => state.settings.home.sections)

  const cards = Object.values(documents).slice(0, homeSectionLimit(sections, 'documents'))

  return (
    <Section id="documents" title={t('home.sections.documents')}>
      <Carousel
        items={cards}
        itemWidth={CARD_WIDTH}
        itemHeight={SHELF_CARD_HEIGHT}
        label={t('home.sections.documents')}
        empty={<p className="text-muted m-0 text-[12px]">{t('home.documents.none')}</p>}
        renderCard={document => (
          <ShelfCard
            icon={iconOf(document)}
            title={document.title}
            subtitle={t(workspaceLabelKey(document.workspace))}
            onClick={() => openDocument(document)}
          />
        )}
      />
    </Section>
  )
}
