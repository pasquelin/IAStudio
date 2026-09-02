import { orElse } from '@shared/promises'
import type { DocumentDescriptor } from '@shared/domain/document'
import { getBridge } from '@/services/bridge'

/**
 * Tells the main process a document was just put in front, for the shelf File ▸ Open recent draws.
 *
 * Called from `openDocument` and nowhere else: every deliberate opening goes through it — the
 * Explorer, the assistant, a creation, a spotlight card — while restoring a layout does not,
 * which is what keeps a launch from reshuffling a list nobody touched.
 *
 * 🛑 The document and nothing else. The PROJECT holding it is composed on the other side, which
 * owns the open project: paired here, a document opened right after a project switch would be
 * filed under the project that had just been left — and this shelf exists for exactly that
 * gesture. It also keeps `dockviewApi` clear of `stores/project`, which reaches back into the
 * shell and closes an import cycle.
 */
export async function noteOpenedDocument(document: DocumentDescriptor): Promise<void> {
  // Swallowed on purpose: the main process journals a settings write that failed, and a list of
  // shortcuts that missed one opening has nothing to say to the person who just opened it.
  await orElse(getBridge()?.documents.opened(document.path, document.kind), undefined)
}
