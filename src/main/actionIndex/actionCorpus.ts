import { ACTION_FAMILIES } from '@shared/domain/assistant'
import type {
  ActionCommitment,
  ActionField,
  ActionName,
  ActionReach,
} from '@shared/domain/assistant'
import { englishText } from '@shared/i18n'
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
        searchable: [
          action.name,
          family.name,
          title,
          description,
          ...fields.flatMap(field => [
            field.key,
            englishText(field.labelKey),
            ...(field.options ?? []),
          ]),
        ].join(' '),
      }
      return indexed
    }),
  )

  return { actions, fingerprint: actionFingerprint(actions) }
}
