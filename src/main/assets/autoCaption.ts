import { ASSET_NAME_MAX_LENGTH, type Asset } from '@shared/domain/asset'
import { chunk } from '@shared/collections'
import { foldForSearch } from '@shared/text'
import type { ActivityReport } from '@main/project/activityLog'

/**
 * How many pictures one caption request carries. The API takes several and asks to be used that
 * way — "if you want to caption multiple images at a time, please prefer using asset ids" — but
 * publishes no cap, so this is deliberately modest: an oversized body is refused whole, and a
 * refusal loses every picture in it, not one.
 */
export const CAPTION_BATCH = 10

/**
 * Names a file gets from a camera or a download — a name that says nothing. Written without
 * accents because they are compared folded: macOS hands its own names out decomposed, so an
 * `é` typed here would not match the `é` it wrote.
 */
const UNINFORMATIVE =
  /^(img|dsc|dscn|pxl|image|photo|screenshot|untitled|download|capture|sans titre|telechargement|image collee|nouvelle image)[-_ ]?\d*$/

/**
 * A screenshot as an operating system actually writes one. Neither macOS nor Windows stops at
 * the bare word: both append the moment it was taken or which copy it is, and both say the
 * word in the language they are set to.
 *
 * What follows has to be that stamp — a digit or a copy number in brackets. `Capture d'écran du
 * menu principal` is a name somebody chose, and paying to describe it would be paying to lose
 * it.
 */
const OS_SCREENSHOT = /^(screen ?shot|capture d['’]ecran)[-_ ]*(\(\d+\)|\d.*)$/

/**
 * A picture the API can be asked about: captioning takes an asset id, and one that never
 * reached the library has none. A guard rather than a predicate so the id below is a string,
 * with no unreachable fallback standing in for what the filter already guaranteed.
 */
export type Describable = Asset & { remoteAssetId: string }

function describable(asset: Asset): asset is Describable {
  return asset.type === 'image' && asset.remoteAssetId !== undefined
}

/**
 * Whether an arriving asset is worth describing.
 *
 * Two conditions, and both are about not spending for nothing. The API must be able to see it,
 * and its name must not already say what it is.
 */
export function worthCaptioning(asset: Asset): asset is Describable {
  if (!describable(asset)) return false

  const stem = foldForSearch(asset.name.replace(/\.[^.]+$/, '').trim())
  return stem === '' || UNINFORMATIVE.test(stem) || OS_SCREENSHOT.test(stem)
}

export type AutoCaptionDeps = {
  /** Bounded on purpose: an arrival of three hundred must not become three hundred calls. */
  queue: <T>(task: () => Promise<T>) => Promise<T>
  caption: (images: readonly string[]) => Promise<string[]>
  /**
   * Gives an asset the name that was written for it — and MOVES its file with it.
   *
   * A rename rather than a save, and that word is the whole of the difference: writing the row
   * on its own left the shelf reading « une ruelle bleue » over a file still called `IMG_1234`,
   * which is precisely the state a row's name being its file's name exists to end. Nothing here
   * knows about folders, so the caller carries out both halves.
   */
  rename: (asset: Asset, name: string) => Promise<unknown>
  record: (report: ActivityReport) => void
  /** `false` leaves every arrival alone — the preference the user can turn off. */
  enabled: () => boolean
}

/**
 * Names what arrives without a useful name of its own.
 *
 * Never throws and never blocks its caller: this was not asked for, so it must not be able to
 * break an import that was. What it has to say, it says to the journal.
 */
export type AutoCaption = (assets: readonly Asset[]) => Promise<void>

/** Names a chosen selection, whatever its assets are already called. Answers how many it named. */
export type DescribeAssets = (assets: readonly Asset[]) => Promise<number>

export type Captioner = {
  onArrival: AutoCaption
  describe: DescribeAssets
}

export function createCaptioner({
  queue,
  caption,
  rename,
  record,
  enabled,
}: AutoCaptionDeps): Captioner {
  const name = async (assets: readonly Describable[]): Promise<number> => {
    let named = 0

    for (const batch of chunk(assets, CAPTION_BATCH)) {
      try {
        const captions = await queue(() => caption(batch.map(asset => asset.remoteAssetId)))

        for (const [index, asset] of batch.entries()) {
          const written = captions[index]?.trim()
          if (!written) continue

          // Held to the same length the rename channel enforces: a caption is a sentence, and
          // this path writes straight into the catalogue without passing that boundary.
          await rename(asset, written.slice(0, ASSET_NAME_MAX_LENGTH).trimEnd())
          named++
        }
      } catch {
        // One refused batch is not a reason to abandon the rest: the next may well succeed.
        record({ level: 'warn', topic: 'library', messageKey: 'activity.captionFailed' })
      }
    }

    if (named > 0) {
      record({
        level: 'info',
        topic: 'library',
        messageKey: 'activity.captioned',
        params: { count: named },
      })
    }

    return named
  }

  return {
    onArrival: async assets => {
      if (!enabled()) return

      const worth = assets.filter(worthCaptioning)
      if (worth.length > 0) await name(worth)
    },

    // No name filter here: the user pointed at these, so a name they already carry is one they
    // asked to replace.
    describe: async assets => {
      const reachable = assets.filter(describable)
      return reachable.length === 0 ? 0 : await name(reachable)
    },
  }
}
