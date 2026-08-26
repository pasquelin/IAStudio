import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ARTICLES_TOPIC, NEWS_TOPICS, type NewsTopic } from '@shared/domain/news'
import { Chip } from '@/design/Chip'
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
  // One topic at a time, and the first family rather than a mixed list: five topics answered at
  // once is five requests for a band nobody has looked at yet.
  const [topic, setTopic] = useState<NewsTopic>(NEWS_TOPICS[0] ?? ARTICLES_TOPIC)
  const news = useNews(topic, reading)

  // A source that says nothing leaves nothing to head: heading, chips and retry button all stood
  // over an empty band. An empty CATEGORY keeps it — the chips are the way to a full one.
  if (news.isError) return null

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
                onClick={() => setTopic(candidate)}
              />
            ))}
          </div>
        )
      }
    >
      <NewsBody items={news.data?.items} reading={reading} />
    </Section>
  )
}

function topicLabel(topic: NewsTopic, t: (key: string) => string): string {
  return topic === ARTICLES_TOPIC ? t('home.news.articles') : t(`families.${topic}`)
}
