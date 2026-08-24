import { createContext } from 'react'

/**
 * Whether the sections below answer for the panel-wide fold order — the one a title row offers
 * as « fold everything ».
 *
 * `useSectionFolds` is one map for the whole window, which was true enough while every folding
 * section lived in the inspector. The shelf and the explorer read their picked row out in
 * sections of their own now, and unscoped those would tell the INSPECTOR's button there is
 * something left to fold, then be folded by it.
 *
 * Public because a context read by a component always is, and set in one place per panel rather
 * than passed down through every section a face happens to draw.
 */
export const SectionFoldScope = createContext(true)
