import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { DocumentDescriptor } from '@shared/domain/document'
import { homeSectionLimit } from '@shared/domain/home'
import { Carousel } from '@/design/Carousel'
import { WORKSPACES, workspaceLabelKey } from '@/helpers/workspaces'
import { useDocuments } from '@/stores/documents'
import { useSettings } from '@/stores/settings'
import { openDocument } from '@/app/dockview-api'
import { Section } from '../Section'
import { SectionNote } from '../SectionNote'
import { ShelfCard, SHELF_CARD_HEIGHT } from '../ShelfCard'

const CARD_WIDTH = 190

function iconOf(document: DocumentDescriptor): string {
  return WORKSPACES.find(workspace => workspace.id === document.workspace)?.icon ?? ''
}

/**
 * The documents this project holds, one click from being in front.
 *
 * Ordered by name rather than by recency: a `DocumentDescriptor` carries no date, and inventing
 * one from the order a `Record` happens to be keyed in would be a lie the shelf tells daily.
 */
export function Documents() {
  const { t } = useTranslation()
  const stored = useDocuments(state => state.stored)
  const sections = useSettings(state => state.settings.home.sections)

  // What the folder holds, not what happens to be open: at launch no tab is, and a shelf that
  // read the tabs would tell someone with a month of work that they have nothing.
  useEffect(() => void useDocuments.getState().relist(), [])

  const cards = stored.slice(0, homeSectionLimit(sections, 'documents'))

  return (
    <Section id="documents" title={t('home.sections.documents')}>
      <Carousel
        items={cards}
        itemWidth={CARD_WIDTH}
        itemHeight={SHELF_CARD_HEIGHT}
        label={t('home.sections.documents')}
        empty={<SectionNote>{t('home.documents.none')}</SectionNote>}
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
