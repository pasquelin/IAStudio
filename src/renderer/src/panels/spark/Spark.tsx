import { mdiCreationOutline } from '@mdi/js'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { QuietNote } from '@/design/QuietNote'
import type { PromptSuggestion } from '@shared/domain/prompt-assist'
import { Button } from '@/design/Button'
import { EmptyState } from '@/design/EmptyState'
import { UiIcon } from '@/design/UiIcon'
import { BUTTON_BASE, BUTTON_NEUTRAL } from '@/design/styles'
import { cn } from '@/helpers/cn'
import { HINT_RIGHT, TIP_RIGHT } from '@/helpers/tooltip'
import { openGeneratorOn } from '@/helpers/generation'
import { toolIcon } from '@/helpers/tool-registry'
import { getBridge } from '@/services/bridge'
import { useModels } from '@/stores/models'

/** Three fit the column without wrapping, and reading more than three is choosing, not sparking. */
const HOW_MANY = 3

/**
 * Ideas to start from, written for the model the generator would open on.
 *
 * Asked for on demand rather than on arrival, which is the whole difference with every other
 * panel of this column: this one calls the API because somebody pressed a button. It costs no
 * creative unit — `generate.prompt` is free — but it is a round trip, and a panel that fires one
 * every time it is opened spends the account's rate limit on something nobody read.
 *
 * The suggestions carry the settings the API proposes with them, already narrowed to what the
 * model declares. Taking one opens the generator on both, so nothing has to be retyped.
 *
 * The button stands in the panel rather than in its title row: an `Actions` component is mounted
 * beside the content, not inside it, and sharing the answer with it would mean a store for three
 * strings nobody else reads.
 */
export function Spark() {
  const { t } = useTranslation()
  const modelId = useModels(state => state.selected.image)
  const [suggestions, setSuggestions] = useState<readonly PromptSuggestion[]>([])
  const [asking, setAsking] = useState(false)

  // No model chosen means no prompt standards to write against: the endpoint conditions on the
  // model, and asking without one would propose in the void. Said rather than drawn empty — a
  // panel that shows nothing reads as a fault, and this one is waiting on a choice made elsewhere.
  if (modelId === undefined) {
    return <EmptyState icon={toolIcon('spark')} message={t('home.spark.noModel')} />
  }

  const ask = (): void => {
    const bridge = getBridge()
    if (!bridge) return

    setAsking(true)
    void bridge.scenario
      .suggestPrompts({ modelId, numResults: HOW_MANY })
      .then(setSuggestions)
      // Silent, as it was as a band: a refused key is the ordinary case, and the button stays.
      .catch(() => setSuggestions([]))
      .finally(() => setAsking(false))
  }

  return (
    <div className="flex flex-col gap-2 p-2">
      <Button {...HINT_RIGHT(t('home.sparkAskHint'))} onClick={ask} disabled={asking}>
        {t(asking ? 'home.spark.asking' : 'home.spark.ask')}
      </Button>

      {suggestions.length === 0 ? (
        <QuietNote>{t('home.spark.help')}</QuietNote>
      ) : (
        suggestions.map(suggestion => (
          <Idea key={suggestion.text} suggestion={suggestion} modelId={modelId} />
        ))
      )}
    </div>
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
      {...TIP_RIGHT(t('home.spark.use', { prompt: suggestion.text }), false, suggestion.rationale)}
      onClick={() => openGeneratorOn('image', modelId, suggestion.parameters)}
      // The docks' own button chrome AND its neutral fill, rather than a copy of either — laid
      // out from the top, since an idea is two lines of prose beside a glyph.
      className={cn(
        BUTTON_BASE,
        BUTTON_NEUTRAL,
        'flex items-start justify-start gap-2 p-3 text-left',
      )}
    >
      <UiIcon path={mdiCreationOutline} size={16} className="text-create mt-px shrink-0" />
      {/* The ink comes from the skin above; only the size and the leading are this card's own. */}
      <span className="text-xs leading-relaxed">{suggestion.text}</span>
    </button>
  )
}
