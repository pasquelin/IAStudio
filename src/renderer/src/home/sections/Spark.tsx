import { mdiCreationOutline } from '@mdi/js'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { PromptSuggestion } from '@shared/domain/prompt-assist'
import { Button } from '@/design/Button'
import { UiIcon } from '@/design/UiIcon'
import { BUTTON_BASE } from '@/design/styles'
import { cn } from '@/helpers/cn'
import { TIP_BOTTOM } from '@/helpers/tooltip'
import { openGeneratorOn } from '@/helpers/generation'
import { getBridge } from '@/services/bridge'
import { useModels } from '@/stores/models'
import { Section } from '../Section'
import { SectionNote } from '../SectionNote'

/** Three fit the width without wrapping, and reading more than three is choosing, not sparking. */
const HOW_MANY = 3

/**
 * Ideas to start from, written for the model the generator would open on.
 *
 * Asked for on demand rather than on arrival, which is the whole difference with every other
 * band: this one calls the API because somebody pressed a button. It costs no creative unit —
 * `generate.prompt` is free — but it is a round trip, and a home that fires one on every launch
 * spends the account's rate limit on a band nobody looked at.
 *
 * The suggestions carry the settings the API proposes with them, already narrowed to what the
 * model declares. Taking one opens the generator on both, so nothing has to be retyped.
 */
export function Spark() {
  const { t } = useTranslation()
  const modelId = useModels(state => state.selected.image)
  const [suggestions, setSuggestions] = useState<readonly PromptSuggestion[]>([])
  const [asking, setAsking] = useState(false)

  // No model chosen means no prompt standards to write against: the endpoint conditions on the
  // model, and asking without one would propose in the void.
  if (modelId === undefined) return null

  const ask = (): void => {
    const bridge = getBridge()
    if (!bridge) return

    setAsking(true)
    void bridge.scenario
      .suggestPrompts({ modelId, numResults: HOW_MANY })
      .then(setSuggestions)
      // Silent, like every band: a refused key is the ordinary case, and the button stays.
      .catch(() => setSuggestions([]))
      .finally(() => setAsking(false))
  }

  return (
    <Section
      id="spark"
      title={t('home.sections.spark')}
      actions={
        <Button onClick={ask} disabled={asking}>
          {t(asking ? 'home.spark.asking' : 'home.spark.ask')}
        </Button>
      }
    >
      {suggestions.length === 0 ? (
        <SectionNote>{t('home.spark.help')}</SectionNote>
      ) : (
        <div className="flex flex-col gap-2">
          {suggestions.map(suggestion => (
            <Idea key={suggestion.text} suggestion={suggestion} modelId={modelId} />
          ))}
        </div>
      )}
    </Section>
  )
}

type IdeaProps = {
  suggestion: PromptSuggestion
  modelId: string
}

function Idea({ suggestion, modelId }: IdeaProps) {
  const { t } = useTranslation()

  return (
    <button
      type="button"
      {...TIP_BOTTOM(t('home.spark.use', { prompt: suggestion.text }), false, suggestion.rationale)}
      onClick={() => openGeneratorOn('image', modelId, suggestion.parameters)}
      // The docks' own button chrome, rather than a fourth hand-written copy of it — laid out
      // from the top, since an idea is two lines of prose beside a glyph.
      className={cn(
        BUTTON_BASE,
        'bg-surface hover:bg-elevated flex items-start justify-start gap-2 p-3 text-left',
      )}
    >
      <UiIcon path={mdiCreationOutline} size={16} className="text-create mt-px shrink-0" />
      <span className="text-text text-[12px] leading-relaxed">{suggestion.text}</span>
    </button>
  )
}
