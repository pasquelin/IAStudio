// SPDX-License-Identifier: MIT
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { inputMapOf, type InputMap } from '@shared/domain/inputMap'
import { Button } from '@/components/Button'
import { Chip } from '@/components/Chip'
import { getBridge } from '@/services/bridge'
import { setDocumentTitle } from '@/features/shell/components/dockviewApi'
import { InputMapExpert } from './InputMapExpert'
import { InputMapJson } from './InputMapJson'
import { InputMapSimple } from './InputMapSimple'

type EditorMode = 'simple' | 'expert' | 'json'
type InputMapDocumentProps = { path: string }
const EDITOR_MODES: readonly EditorMode[] = ['simple', 'expert', 'json']

function formatted(map: InputMap): string {
  return JSON.stringify(map, null, 2)
}

export function InputMapDocument({ path }: InputMapDocumentProps) {
  const { t } = useTranslation()
  const [map, setMap] = useState<InputMap | null>(null)
  const [source, setSource] = useState('')
  const [mode, setMode] = useState<EditorMode>('simple')
  const [modified, setModified] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const load = async (): Promise<void> => {
      const loaded = await getBridge()?.inputMaps.read(path)
      if (!active) return
      if (!loaded) {
        setError(t('game.inputMap.loadFailed'))
        return
      }
      setMap(loaded)
      setSource(formatted(loaded))
    }
    void load()
    return () => {
      active = false
    }
  }, [path, t])

  useEffect(
    () => setDocumentTitle(`file:${path}`, map?.id ?? '', modified),
    [map?.id, modified, path],
  )

  const changeMap = (next: InputMap): void => {
    setMap(next)
    setSource(formatted(next))
    setModified(true)
    setError(null)
  }

  const save = async (): Promise<void> => {
    try {
      const next = mode === 'json' ? inputMapOf(JSON.parse(source)) : inputMapOf(map)
      const written = await getBridge()?.inputMaps.write(path, next)
      if (!written) throw new Error('write refused')
      setMap(next)
      setSource(formatted(next))
      setModified(false)
      setError(null)
    } catch {
      setError(t('game.inputMap.invalid'))
    }
  }

  if (!map)
    return (
      <div role="status" className="text-muted flex size-full items-center justify-center text-xs">
        {error ?? t('game.inputMap.loading')}
      </div>
    )

  return (
    <div className="bg-surface text-text flex size-full min-h-0 flex-col">
      <header className="border-border bg-panel flex items-center gap-1.5 border-b p-(--sc-gutter)">
        {EDITOR_MODES.map(id => (
          <Chip
            key={id}
            label={t(`game.inputMap.mode.${id}`)}
            hint={t('game.inputMap.modeHint')}
            selected={mode === id}
            onClick={() => setMode(id)}
          />
        ))}
        <span className="flex-1" />
        <Button variant="primary" onClick={() => void save()}>
          {t('game.inputMap.save')}
        </Button>
      </header>
      {error && (
        <p role="alert" className="text-warning m-0 px-3 py-2 text-xs">
          {error}
        </p>
      )}
      {mode === 'simple' && <InputMapSimple map={map} onChange={changeMap} />}
      {mode === 'expert' && <InputMapExpert map={map} onChange={changeMap} />}
      {mode === 'json' && (
        <InputMapJson
          value={source}
          onChange={value => {
            setSource(value)
            setModified(true)
            setError(null)
          }}
        />
      )}
    </div>
  )
}
