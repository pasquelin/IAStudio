import { mdiContentSave, mdiFilePlusOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { ToolButton } from '@/design/ToolButton'
import { TIP_BOTTOM } from '@/helpers/tooltip'
import { freeScriptPath, isCodeDirty, useCode } from '@/stores/code'

const STARTER = `import { defineScript } from '@studio'

export default defineScript({
  props: { speed: 4 },

  onUpdate(self, ctx, dt) {
    if (ctx.input.down('KeyW')) self.moveBy(0, 0, -self.props.speed * dt)
  },
})
`

/** What the title row of the code panel carries: make one, write the open one down. */
export function CodeActions() {
  const { t } = useTranslation()
  const active = useCode(state => state.active)
  const dirty = useCode(state =>
    isCodeDirty(state.active === null ? undefined : state.files[state.active]),
  )

  return (
    <div className="flex items-center gap-2">
      <ToolButton
        icon={mdiFilePlusOutline}
        label={t('code.new')}
        description={t('code.newHint')}
        tooltip={TIP_BOTTOM}
        onClick={() => void makeScript()}
      />
      <ToolButton
        icon={mdiContentSave}
        label={t('code.save')}
        description={t('code.saveHint')}
        tooltip={TIP_BOTTOM}
        disabled={active === null || !dirty}
        onClick={() => {
          if (active !== null) void useCode.getState().save(active)
        }}
      />
    </div>
  )
}

/** A file on disk before a tab on screen: an editor showing what the project does not hold lies. */
async function makeScript(): Promise<void> {
  const script = freeScriptPath(useCode.getState(), 'Script')
  useCode.setState(state => ({
    files: { ...state.files, [script]: { script, saved: '', source: STARTER } },
  }))

  try {
    if (await useCode.getState().save(script)) return useCode.getState().show(script)
  } catch {
    // Falls through to the same cleanup: a refusal and a broken bridge leave the same ghost.
  }
  // 🛑 Taken back out: a file the project refused must not sit in the list as one it holds — the
  // next walk would drop it, and the author's starter with it, without a word.
  useCode.setState(state => ({
    files: Object.fromEntries(Object.entries(state.files).filter(([one]) => one !== script)),
  }))
}
