import { mdiChevronDown, mdiChevronRight } from '@mdi/js'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ToolButton } from '@/design/ToolButton'
import { TIP_RIGHT } from '@/helpers/tooltip'
import { getBridge } from '@/services/bridge'

/** Open, and what came back — one state, so a second press before the answer asks nothing twice. */
type Unfolded = { open: boolean; asked: boolean; text: string | null }

const FOLDED: Unfolded = { open: false, asked: false, text: null }

/** What one round trip carried, whole, on demand — see `StudioBridge.assistant.said`. */
export function ActivityListSaid({ said }: { said: string }) {
  const { t } = useTranslation()
  const [shown, setShown] = useState<Unfolded>(FOLDED)

  const unfold = async (): Promise<void> => {
    if (shown.asked) {
      setShown(current => ({ ...current, open: !current.open }))
      return
    }

    setShown({ open: true, asked: true, text: null })
    try {
      setShown({ open: true, asked: true, text: (await getBridge()?.assistant.said(said)) ?? null })
    } catch {
      // Swallowed with a word: the pane below says the text is gone, which is what a refused
      // channel and a line older than the ring both leave the reader with.
      setShown({ open: true, asked: true, text: null })
    }
  }

  return (
    <>
      <ToolButton
        icon={shown.open ? mdiChevronDown : mdiChevronRight}
        label={t('activity.said')}
        description={t('activity.saidHint')}
        tooltip={TIP_RIGHT}
        variant="header"
        className="w-auto self-start px-1"
        aria-expanded={shown.open}
        onClick={() => void unfold()}
      >
        {t('activity.said')}
      </ToolButton>

      {shown.open &&
        (shown.text === null ? (
          <p className="text-muted text-mini m-0">{t('activity.saidGone')}</p>
        ) : (
          // No height of its own and no scroller: a pane that scrolls inside a pane traps the
          // wheel, and the journal already scrolls. The text unfolds whole.
          <pre className="text-muted text-mini bg-panel p-2 font-mono break-all whitespace-pre-wrap">
            {shown.text}
          </pre>
        ))}
    </>
  )
}
