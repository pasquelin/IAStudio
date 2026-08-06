import type { DescripteurChamp, FamilleModele, SorteChamp } from '@shared/domain/modele'

/**
 * Forme d'un input de modèle telle que renvoyée par `GET /models/{id}`. Recopiée plutôt
 * qu'importée du SDK : c'est la frontière avec l'extérieur, et elle doit survivre au
 * jour où Scenario ajoute un champ qu'on ne connaît pas.
 */
export type InputScenario = {
  name: string
  type: string
  label?: string
  description?: string
  hint?: string
  placeholder?: string
  group?: string
  kind?: string
  color?: boolean
  prompt?: boolean
  default?: unknown
  min?: number
  max?: number
  step?: number
  minLength?: number
  maxLength?: number
  allowedValues?: unknown[]
  required?: { always?: boolean } | null
}

function estEntier(valeur: number | undefined): boolean {
  return valeur !== undefined && Number.isInteger(valeur)
}

function sorteDe(input: InputScenario): SorteChamp {
  if (input.name === 'seed') return 'graine'

  switch (input.type) {
    case 'boolean':
      return 'booleen'
    case 'number':
      // Un pas fractionnaire (guidance 0.5) est un réel ; sans pas, des bornes entières
      // suffisent à trancher — sinon on reste sur un réel, qui accepte les entiers.
      if (input.step !== undefined) return estEntier(input.step) ? 'entier' : 'nombre'
      return estEntier(input.min) && estEntier(input.max) ? 'entier' : 'nombre'
    case 'string':
      if (input.allowedValues?.length) return 'choix'
      if (input.color) return 'couleur'
      if (input.prompt) return 'texteLong'
      return 'texte'
    case 'file':
      return input.kind === 'image' || input.kind === 'image-hdr' ? 'image' : 'brut'
    default:
      return 'brut'
  }
}

function libelleDe(input: InputScenario): string {
  if (input.label) return input.label
  // `numInferenceSteps` → `Num inference steps` : un nom d'API reste lisible plutôt que brut.
  const espace = input.name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
  return espace.charAt(0).toUpperCase() + espace.slice(1)
}

function optionsDe(input: InputScenario): DescripteurChamp['options'] {
  if (!input.allowedValues?.length) return undefined
  return input.allowedValues.map(valeur => ({
    valeur: String(valeur),
    libelle: String(valeur),
  }))
}

/**
 * Traduit les inputs d'un modèle en descripteurs de champs. Un type inconnu retombe en
 * saisie brute : un modèle que Scenario vient d'ajouter doit rester utilisable, jamais
 * faire disparaître le formulaire — cf. spec § 6.
 */
export function traduireSchema(inputs: readonly InputScenario[] | undefined): DescripteurChamp[] {
  if (!inputs) return []

  return inputs.map(input => {
    const descripteur: DescripteurChamp = {
      cle: input.name,
      sorte: sorteDe(input),
      libelle: libelleDe(input),
      requis: input.required?.always === true,
    }

    const aide = input.description ?? input.hint ?? input.placeholder
    if (aide !== undefined) descripteur.aide = aide
    if (input.group !== undefined) descripteur.groupe = input.group
    if (input.default !== undefined) descripteur.defaut = input.default
    if (input.min !== undefined) descripteur.min = input.min
    if (input.max !== undefined) descripteur.max = input.max
    if (input.step !== undefined) descripteur.pas = input.step

    const options = optionsDe(input)
    if (options) descripteur.options = options

    return descripteur
  })
}

const FAMILLES_PAR_CAPACITE: readonly { motif: RegExp; famille: FamilleModele }[] = [
  { motif: /video$/, famille: 'video' },
  { motif: /3d$/, famille: '3d' },
  { motif: /audio$/, famille: 'audio' },
  { motif: /img|inpaint|outpaint|reference|texture/, famille: 'image' },
]

/**
 * Déduit la famille d'un modèle de ses capacités. L'ordre compte : `img2video` est un
 * modèle vidéo, pas un modèle image, et les suffixes tranchent avant les motifs larges.
 */
export function familleDe(capacites: readonly string[] | undefined): FamilleModele {
  if (!capacites?.length) return 'autre'
  for (const { motif, famille } of FAMILLES_PAR_CAPACITE) {
    if (capacites.some(capacite => motif.test(capacite))) return famille
  }
  return 'autre'
}
