import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { completedOnboarding, WELCOME_SLIDES } from '@shared/domain/welcome'
import { TooltipHost } from '@/components/TooltipHost'
import { useAppliedSettings } from '@/hooks/useAppliedSettings'
import { useConnections } from '@/hooks/useConnections'
import { useAccounts } from '@/stores/accounts'
import { useProject } from '@/stores/project'
import { useSettings } from '@/stores/settings'
import { WelcomeCanvas } from './WelcomeCanvas'
import { WelcomeFooter } from './WelcomeFooter'
import { WelcomeMasthead } from './WelcomeMasthead'
import { WelcomeStage } from './WelcomeStage'
import { WelcomeSlideAccount } from './WelcomeSlideAccount'
import { WelcomeSlideCraft } from './WelcomeSlideCraft'
import { WelcomeSlideLanguage } from './WelcomeSlideLanguage'
import { WelcomeSlideLook } from './WelcomeSlideLook'
import { WelcomeSlideProject } from './WelcomeSlideProject'

export function WelcomeWindow() {
  const { t } = useTranslation()
  const [index, setIndex] = useState(0)
  const connect = useSettings(state => state.connect)
  const connectAccounts = useAccounts(state => state.connect)
  const connectProject = useProject(state => state.connect)
  const write = useSettings(state => state.write)

  useConnections([connect, connectAccounts, connectProject])
  useAppliedSettings()

  const last = WELCOME_SLIDES.length - 1
  const goTo = useCallback(
    (next: number) => {
      setIndex(Math.min(last, Math.max(0, next)))
    },
    [last],
  )

  const finish = useCallback(async () => {
    await write({ onboarding: completedOnboarding(new Date().toISOString()) })
    window.close()
  }, [write])

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        void finish()
        return
      }
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select')) {
        return
      }
      if (event.key === 'ArrowRight' || event.key === 'Enter') {
        event.preventDefault()
        if (index >= last) void finish()
        else goTo(index + 1)
        return
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        goTo(index - 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [finish, goTo, index, last])

  const titles = [
    t('welcome.language.title'),
    t('welcome.look.title'),
    t('welcome.craft.title'),
    t('welcome.account.title'),
    t('welcome.project.title'),
  ]

  return (
    <div className="text-base-content relative h-screen overflow-hidden">
      <WelcomeCanvas slide={index} />
      <div className="relative z-10 flex h-full flex-col">
        <WelcomeMasthead />
        <WelcomeStage index={index}>
          <WelcomeSlideLanguage />
          <WelcomeSlideLook />
          <WelcomeSlideCraft />
          <WelcomeSlideAccount />
          <WelcomeSlideProject />
        </WelcomeStage>
        <WelcomeFooter
          index={index}
          titles={titles}
          onBack={() => goTo(index - 1)}
          onNext={() => {
            if (index >= last) void finish()
            else goTo(index + 1)
          }}
          onSkip={() => void finish()}
          onGoTo={goTo}
        />
      </div>
      <TooltipHost />
    </div>
  )
}
