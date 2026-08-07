import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Licence } from '@shared/domain/licence'
import licences from '@shared/licences.json'
import { DRAGGABLE } from '@/helpers/app-region'
import { useAppliedSettings } from '@/hooks/useAppliedSettings'

/**
 * The notice every shipped licence asks for. Outside the docks, so DaisyUI rather than the
 * design system — this is the application being an application.
 *
 * The whole text of each licence is here rather than a link: a notice that needs a working
 * network to be read is not a notice.
 */
export function LicencesWindow() {
  const { t } = useTranslation()
  const [openName, setOpenName] = useState<string | null>(null)
  useAppliedSettings()

  const entries: Licence[] = licences

  return (
    <div className="bg-chassis text-text flex h-screen flex-col">
      <header style={DRAGGABLE} className="flex shrink-0 items-center px-4 pt-6 pb-3 pl-24">
        <h1 className="text-[13px] font-semibold">{t('licences.title')}</h1>
      </header>

      <p className="text-muted shrink-0 px-4 pb-3 text-xs">{t('licences.intro')}</p>

      <ul className="min-h-0 flex-1 overflow-auto px-4 pb-4">
        {entries.map(entry => (
          <li key={entry.name} className="border-border border-b last:border-b-0">
            <button
              type="button"
              aria-expanded={openName === entry.name}
              onClick={() => setOpenName(current => (current === entry.name ? null : entry.name))}
              className="hover:bg-surface flex w-full cursor-pointer items-baseline gap-2 py-2 text-left"
            >
              <span className="text-[13px]">{entry.name}</span>
              <span className="text-muted text-[11px]">{entry.version}</span>
              <span className="text-muted ml-auto text-[11px]">{entry.spdx}</span>
            </button>

            {openName === entry.name && (
              <div className="pb-3">
                {entry.sources && (
                  <p className="text-muted pb-2 text-[11px]">
                    {t('licences.sources')} {entry.sources}
                  </p>
                )}
                <pre className="bg-surface text-muted max-h-72 overflow-auto rounded p-3 text-[11px] whitespace-pre-wrap">
                  {entry.text}
                </pre>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
