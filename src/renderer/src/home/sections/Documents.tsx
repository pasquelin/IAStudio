import { useTranslation } from 'react-i18next'
import type { DocumentDescriptor } from '@shared/domain/document'
import { Carousel } from '@/design/Carousel'
import { UiIcon } from '@/design/UiIcon'
import { FOCUS_RING } from '@/design/styles'
import { cn } from '@/helpers/cn'
import { WORKSPACES, workspaceLabelKey } from '@/helpers/workspaces'
import { useDocuments } from '@/stores/documents'
import { useSettings } from '@/stores/settings'
import { homeSectionLimit } from '@shared/domain/home'
import { openExistingDocument } from '../open'
import { Section } from '../Section'

const CARD_WIDTH = 190
const CARD_HEIGHT = 84

function iconOf(document: DocumentDescriptor): string {
  return WORKSPACES.find(workspace => workspace.id === document.workspace)?.icon ?? ''
}

/** What is already open in this project, one click from being in front again. */
export function Documents() {
  const { t } = useTranslation()
  const documents = useDocuments(state => state.documents)
  const sections = useSettings(state => state.settings.home.sections)

  const limit = homeSectionLimit(sections, 'documents')
  const cards = Object.values(documents).slice(0, limit)

  return (
    <Section title={t('home.sections.documents')}>
      <Carousel
        items={cards}
        itemWidth={CARD_WIDTH}
        itemHeight={CARD_HEIGHT}
        label={t('home.sections.documents')}
        empty={<p className="text-muted m-0 text-[12px]">{t('home.documents.none')}</p>}
        renderCard={document => (
          <button
            type="button"
            onClick={() => openExistingDocument(document)}
            className={cn(
              'bg-surface hover:bg-elevated flex size-full cursor-pointer flex-col justify-center',
              'gap-1 rounded-(--radius-sc-md) border-none px-3 text-left transition-colors',
              FOCUS_RING,
            )}
          >
            <span className="flex items-center gap-2">
              <UiIcon path={iconOf(document)} size={16} className="text-muted shrink-0" />
              <span className="text-text truncate text-[12px]">{document.title}</span>
            </span>
            <span className="text-muted truncate text-[11px]">
              {t(workspaceLabelKey(document.workspace))}
            </span>
          </button>
        )}
      />
    </Section>
  )
}
