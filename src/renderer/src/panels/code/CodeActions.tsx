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
  const code = useCode.getState()
  const script = freeScriptPath(code, 'Script')

  code.edited(script, STARTER)
  useCode.setState(state => ({
    files: { ...state.files, [script]: { script, saved: '', source: STARTER } },
  }))
  if (await code.save(script)) code.show(script)
}
