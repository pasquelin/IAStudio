import { rowSkin } from '@/components/styles'
import { cn } from '@/helpers/cn'

/**
 * One row of the band, and the room the waiting state reserves for it. Shared by the two so the
 * height cannot drift between what is announced and what arrives.
 *
 * `--sc-control` is the studio's row gauge: it follows the density setting, where a number
 * written here would be right at one of the two.
 */
export const NEWS_ROW = cn(rowSkin(false), 'flex h-(--sc-control) items-center gap-3 px-2')
