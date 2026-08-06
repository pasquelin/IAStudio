import { describe, expect, it } from 'vitest'
import { familleDe, traduireSchema, type InputScenario } from './traduction-schema'

describe('traduireSchema', () => {
  it('traduit un entier borné en champ entier', () => {
    const [champ] = traduireSchema([
      { name: 'numInferenceSteps', type: 'number', min: 1, max: 50, step: 1, default: 28 },
    ])
    expect(champ).toMatchObject({
      cle: 'numInferenceSteps',
      sorte: 'entier',
      min: 1,
      max: 50,
      pas: 1,
      defaut: 28,
    })
  })

  it('traduit un pas fractionnaire en réel', () => {
    const [champ] = traduireSchema([
      { name: 'guidance', type: 'number', step: 0.5, min: 1, max: 10 },
    ])
    expect(champ?.sorte).toBe('nombre')
  })

  it('fait une liste déroulante d’un string à valeurs autorisées', () => {
    const [champ] = traduireSchema([
      { name: 'aspectRatio', type: 'string', allowedValues: ['1:1', '16:9'] },
    ])
    expect(champ?.sorte).toBe('choix')
    expect(champ?.options).toEqual([
      { valeur: '1:1', libelle: '1:1' },
      { valeur: '16:9', libelle: '16:9' },
    ])
  })

  it('distingue prompt, couleur et texte simple', () => {
    const champs = traduireSchema([
      { name: 'prompt', type: 'string', prompt: true },
      { name: 'background', type: 'string', color: true },
      { name: 'nom', type: 'string' },
    ])
    expect(champs.map(champ => champ.sorte)).toEqual(['texteLong', 'couleur', 'texte'])
  })

  it('reconnaît la graine à son nom', () => {
    const [champ] = traduireSchema([{ name: 'seed', type: 'number' }])
    expect(champ?.sorte).toBe('graine')
  })

  it('traite un fichier image comme une image et le reste en brut', () => {
    const champs = traduireSchema([
      { name: 'image', type: 'file', kind: 'image' },
      { name: 'doc', type: 'file', kind: 'document' },
    ])
    expect(champs.map(champ => champ.sorte)).toEqual(['image', 'brut'])
  })

  it('retombe en saisie brute sur un type inconnu au lieu de disparaître', () => {
    const champs = traduireSchema([{ name: 'machin', type: 'chose-inconnue' }])
    expect(champs).toHaveLength(1)
    expect(champs[0]?.sorte).toBe('brut')
  })

  it('rend lisible un nom d’API sans libellé', () => {
    const [champ] = traduireSchema([{ name: 'numInferenceSteps', type: 'number' }])
    expect(champ?.libelle).toBe('Num inference steps')
  })

  it('préfère le libellé fourni par le modèle', () => {
    const [champ] = traduireSchema([{ name: 'numInferenceSteps', type: 'number', label: 'Étapes' }])
    expect(champ?.libelle).toBe('Étapes')
  })

  it('ne marque requis que si la règle est « toujours »', () => {
    const champs = traduireSchema([
      { name: 'a', type: 'string', required: { always: true } },
      { name: 'b', type: 'string', required: {} },
      { name: 'c', type: 'string' },
    ])
    expect(champs.map(champ => champ.requis)).toEqual([true, false, false])
  })

  it('accepte une absence totale d’inputs', () => {
    expect(traduireSchema(undefined)).toEqual([])
  })

  it("n'invente pas de valeur par défaut absente", () => {
    const [champ] = traduireSchema([{ name: 'a', type: 'string' }])
    expect(champ).not.toHaveProperty('defaut')
  })

  it('préserve toutes les entrées, y compris inconnues', () => {
    const inputs: InputScenario[] = [
      { name: 'a', type: 'string' },
      { name: 'b', type: 'inputs_array' },
      { name: 'c', type: 'model' },
    ]
    expect(traduireSchema(inputs)).toHaveLength(3)
  })
})

describe('familleDe', () => {
  it('classe un modèle image-vers-vidéo en vidéo, pas en image', () => {
    expect(familleDe(['img2video', 'txt2video'])).toBe('video')
  })

  it('reconnaît la 3D, l’audio et l’image', () => {
    expect(familleDe(['img23d'])).toBe('3d')
    expect(familleDe(['txt2audio'])).toBe('audio')
    expect(familleDe(['txt2img', 'inpaint'])).toBe('image')
  })

  it('retombe sur « autre » sans capacité exploitable', () => {
    expect(familleDe([])).toBe('autre')
    expect(familleDe(undefined)).toBe('autre')
    expect(familleDe(['txt2txt'])).toBe('autre')
  })
})
