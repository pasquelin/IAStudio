import { mdiFolderOpenOutline, mdiRenameOutline, mdiTrashCanOutline } from '@mdi/js'
import type { TFunction } from 'i18next'
import { DOCUMENTS_FOLDER, type DocumentDescriptor } from '@shared/domain/document'
import { showContextMenu } from '@/helpers/context-menu'
import { getBridge } from '@/services/bridge'
import { reportFailure } from '@/services/diagnostics'
import { deleteDocument } from '@/app/document-io'

export type DocumentMenuProps = {
  document: DocumentDescriptor
  /** The window's translator, as every menu of this studio takes it — see `openAssetMenu`. */
  t: TFunction
  /** Hands the rename back to the row, which owns the field — as `openLayerMenu` does. */
  onRename: () => void
}

/**
 * What can be done with one document of the project, listed rather than opened.
 *
 * The same three the explorer offers a file, said of the document: this panel lists documents
 * where that one lists a folder, and a gesture available in one and not the other is a gesture
 * nobody finds twice.
 */
export function openDocumentMenu({ document, t, onRename }: DocumentMenuProps): void {
  void showContextMenu([
    {
      label: t('documents.rename'),
      icon: mdiRenameOutline,
      tooltip: t('documents.renameHint'),
      onSelect: onRename,
    },
    {
      label: t('explorer.reveal'),
      icon: mdiFolderOpenOutline,
      tooltip: t('explorer.revealHint'),
      // The entry the descriptor came back with, never a name rebuilt from the title: the two
      // agree for anything written since documents came to be named, and they do NOT for one
      // written before that — its file still wears the uuid it was named after.
      onSelect: () =>
        void getBridge()?.project.revealFile(`${DOCUMENTS_FOLDER}/${document.fileName}`),
    },
    {
      label: t('documents.delete'),
      icon: mdiTrashCanOutline,
      tooltip: t('documents.deleteHint'),
      onSelect: () =>
        void deleteDocument(document.id).catch(error =>
          reportFailure('document.delete', document.title, error),
        ),
    },
  ])
}
