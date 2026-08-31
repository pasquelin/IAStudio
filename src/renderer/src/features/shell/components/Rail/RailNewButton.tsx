import { mdiPlus } from '@mdi/js'
import { kindForWorkspace } from '@shared/domain/document'
import { useTranslation } from 'react-i18next'
import { TIP_RIGHT } from '@/helpers/tooltip'
import { ToolButton } from '@/components/ToolButton'
import { useLayouts, useToolSurface } from '@/stores/layouts'
import { useProject } from '@/stores/project'
import { createDocumentIn } from '../../newDocument'
import { HOME_SURFACE } from '@shared/domain/tool'

/**
 * Above the tool icons rather than in the Explorer header: it stays reachable when every panel
 * is closed. Disabled — not hidden — where no editor exists yet: a button that vanishes reads
 * as a display bug.
 *
 * It makes what the surface makes. A space makes documents; the home makes the project they
 * need — and a document created from the home would land in the space behind it, out of sight
 * of the screen that was asked.
 */
export function RailNewButton() {
  const { t } = useTranslation()
  const surface = useToolSurface()
  const workspace = useLayouts(state => state.activeWorkspace)
  const project = useProject(state => state.project)

  const home = surface === HOME_SURFACE

  return (
    <ToolButton
      icon={mdiPlus}
      iconSize={22}
      label={home ? t('home.tools.newProject') : t('documents.new')}
      tooltip={TIP_RIGHT}
      // A document is a file in a project folder: with no project open there is nowhere to write
      // it, and the create would fail after the click rather than before it. A project needs no
      // project, so on the home the button is never dead.
      disabled={!home && (kindForWorkspace(workspace) === null || !project)}
      onClick={() =>
        home ? void useProject.getState().createPicked() : void createDocumentIn(workspace)
      }
      // Filled, unlike every tool icon around it: this one acts, the others only switch what is
      // shown. A grey plus among grey glyphs is a plus nobody finds.
      className="bg-create hover:bg-create-hover text-create-content hover:text-create-content size-(--sc-rail-button) rounded-(--radius-sc-md) disabled:bg-transparent disabled:text-current"
    />
  )
}
