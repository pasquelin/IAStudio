import { useTranslation } from 'react-i18next'
import { Explorer as ExplorerPanel } from '@/panels/explorer/Explorer'
import { Section } from '../Section'

/**
 * How tall the tree stands in the aside. Fixed rather than filling the column: the page is one
 * long scroll, and a list that grew with it would put the last document below the fold of a home
 * that has nothing to do with documents at that point.
 */
const HEIGHT = 420

/**
 * The project's documents, down the side of the home, from the very same panel the workspaces
 * dock. One list and one behaviour — a second reading of the same folder would be a second
 * chance to disagree with it, and the double-click that opens a document is a gesture people
 * already have from the shelf.
 */
export function Explorer() {
  const { t } = useTranslation()

  return (
    <Section id="explorer" title={t('home.sections.explorer')}>
      <div className="bg-surface rounded-(--radius-sc-lg) p-1" style={{ height: HEIGHT }}>
        <ExplorerPanel />
      </div>
    </Section>
  )
}
