import { ACTION_FAMILIES } from '@shared/domain/assistant'
import type {
  ActionCommitment,
  ActionField,
  ActionName,
  ActionReach,
  ActionResource,
  ActionCapabilities,
} from '@shared/domain/assistant'
import { englishText, textAt, TRANSLATIONS } from '@shared/i18n'
import { digestOf } from '@main/memory/vectors'

export type IndexedAction = {
  name: ActionName
  family: string
  title: string
  description: string
  commitment: ActionCommitment
  repeatable: boolean
  reach: ActionReach
  fields: readonly ActionField[]
  raisesCommitment: boolean
  asksItself: boolean
  runsOthers: boolean
  ordinal: number
  searchable: string
  localizedTitles: readonly string[]
  localizedFieldLabels: readonly string[]
  requires: readonly ActionResource[]
  produces: readonly ActionResource[]
  inputs: readonly ActionResource[]
  uses: readonly ActionResource[]
  returns: readonly ActionResource[]
  capabilities: ActionCapabilities
}

export type ActionCorpus = {
  fingerprint: string
  actions: readonly IndexedAction[]
}

export function actionFingerprint(actions: readonly IndexedAction[]): string {
  return digestOf(JSON.stringify(actions))
}

export function actionCorpus(): ActionCorpus {
  let ordinal = 0
  const actions = ACTION_FAMILIES.flatMap(family =>
    family.actions.map(action => {
      const title = englishText(action.titleKey)
      const description = englishText(action.descriptionKey)
      const frenchTitle = textAt(TRANSLATIONS.fr, action.titleKey)
      const frenchDescription = textAt(TRANSLATIONS.fr, action.descriptionKey)
      const fields = action.fields.map(field => ({ ...field }))
      const indexed: IndexedAction = {
        name: action.name,
        family: family.name,
        title,
        description,
        commitment: action.commitment,
        repeatable: action.repeatable,
        reach: action.reach,
        fields,
        raisesCommitment: action.raises !== undefined,
        asksItself: action.asksItself === true,
        runsOthers: action.runsOthers === true,
        ordinal: ordinal++,
        localizedTitles: [title, frenchTitle],
        requires: action.requires ?? [],
        produces: action.produces ?? [],
        inputs: action.inputs ?? [],
        uses: action.uses ?? [],
        returns: action.returns ?? [],
        capabilities: action.capabilities ?? {},
        localizedFieldLabels: fields.flatMap(field => [
          englishText(field.labelKey),
          textAt(TRANSLATIONS.fr, field.labelKey),
        ]),
        searchable: [
          action.name,
          family.name,
          title,
          description,
          frenchTitle,
          frenchDescription,
          ...fields.flatMap(field => [
            field.key,
            englishText(field.labelKey),
            textAt(TRANSLATIONS.fr, field.labelKey),
            ...(field.options ?? []),
          ]),
        ].join(' '),
      }
      return indexed
    }),
  )

  return { actions, fingerprint: actionFingerprint(actions) }
}
