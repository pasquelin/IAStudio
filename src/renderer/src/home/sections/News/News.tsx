import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ARTICLES_TOPIC, NEWS_TOPICS, OPENING_TOPIC, type NewsTopic } from '@shared/domain/news'
import { Chip } from '@/components/Chip'
import { useNews } from '@/hooks/useNews'
import { HINT_BOTTOM } from '@/helpers/tooltip'
import { useSettings } from '@/stores/settings'
import { Section } from '../../Section'
import { NewsBody } from './NewsBody'

/**
 * What is moving outside this studio: the models trending on the hub, by family, and the
 * articles beside them.
 *
 * 🛑 It reads huggingface.co — the ONLY outward call the studio makes for something other than a
 * model or a job. The same host every weight of the catalogue is fetched from, so no third party
 * learns anything new; it is a setting all the same, because a person may want a studio that
 * talks to nobody.
 */
export function News() {
  const { t } = useTranslation()
  const reading = useSettings(state => state.settings.home.news)
  const [chosen, setChosen] = useState<NewsTopic | null>(null)
  const topic = chosen ?? OPENING_TOPIC
  const news = useNews(topic, reading)

  // Untouched and with nothing to show, it does not open: a heading, five chips and a line
  // saying so is worse than no band. Once a chip has been pressed the band ALWAYS answers, note
  // and all — one that vanished under the press would take the way back to a full category with
  // it, and the main process holds a page for six hours.
  //
  // `reading` guards the whole of it: switched off, the query is disabled and `data` is whatever
  // the cache still holds, which would take the "switch it back on" line off the page with it.
  if (reading && chosen === null && (news.isError || news.data?.items.length === 0)) return null

  return (
    <Section
      id="news"
      title={t('home.sections.news')}
      actions={
        reading && (
          <div className="flex flex-wrap gap-2">
            {NEWS_TOPICS.map(candidate => (
              <Chip
                key={candidate}
                label={topicLabel(candidate, t)}
                hint={t('home.news.topicHint')}
                selected={candidate === topic}
                tip={HINT_BOTTOM}
                onClick={() => setChosen(candidate)}
              />
            ))}
          </div>
        )
      }
    >
      <NewsBody news={news} reading={reading} />
    </Section>
  )
}

function topicLabel(topic: NewsTopic, t: (key: string) => string): string {
  return topic === ARTICLES_TOPIC ? t('home.news.articles') : t(`families.${topic}`)
}
