import { describe, expect, it } from 'vitest'
import { familyOf, translateSchema, type ScenarioInput } from './schema'

describe('translateSchema', () => {
  it('traduit un entier borné en champ entier', () => {
    const [field] = translateSchema([
      { name: 'numInferenceSteps', type: 'number', min: 1, max: 50, step: 1, default: 28 },
    ])
    expect(field).toMatchObject({
      key: 'numInferenceSteps',
      kind: 'integer',
      min: 1,
      max: 50,
      step: 1,
      default: 28,
    })
  })

  it('traduit un pas fractionnaire en réel', () => {
    const [field] = translateSchema([
      { name: 'guidance', type: 'number', step: 0.5, min: 1, max: 10 },
    ])
    expect(field?.kind).toBe('number')
  })

  it('fait une liste déroulante d’un string à valeurs autorisées', () => {
    const [field] = translateSchema([
      { name: 'aspectRatio', type: 'string', allowedValues: ['1:1', '16:9'] },
    ])
    expect(field?.kind).toBe('choice')
    expect(field?.options).toEqual([
      { value: '1:1', label: '1:1' },
      { value: '16:9', label: '16:9' },
    ])
  })

  it('distingue prompt, couleur et texte simple', () => {
    const fields = translateSchema([
      { name: 'prompt', type: 'string', prompt: true },
      { name: 'background', type: 'string', color: true },
      { name: 'title', type: 'string' },
    ])
    expect(fields.map(field => field.kind)).toEqual(['longText', 'color', 'text'])
  })

  it('reconnaît la graine à son nom', () => {
    const [field] = translateSchema([{ name: 'seed', type: 'number' }])
    expect(field?.kind).toBe('seed')
  })

  it('traite un fichier image comme une image et le reste en brut', () => {
    const fields = translateSchema([
      { name: 'image', type: 'file', kind: 'image' },
      { name: 'doc', type: 'file', kind: 'document' },
    ])
    expect(fields.map(field => field.kind)).toEqual(['image', 'raw'])
  })

  it('retombe en saisie brute sur un type inconnu au lieu de disparaître', () => {
    const fields = translateSchema([{ name: 'whatever', type: 'unknown-type' }])
    expect(fields).toHaveLength(1)
    expect(fields[0]?.kind).toBe('raw')
  })

  it('rend lisible un nom d’API sans libellé', () => {
    const [field] = translateSchema([{ name: 'numInferenceSteps', type: 'number' }])
    expect(field?.label).toBe('Num inference steps')
  })

  it('préfère le libellé fourni par le modèle', () => {
    const [field] = translateSchema([
      { name: 'numInferenceSteps', type: 'number', label: 'Étapes' },
    ])
    expect(field?.label).toBe('Étapes')
  })

  it('ne marque requis que si la règle est « toujours »', () => {
    const fields = translateSchema([
      { name: 'a', type: 'string', required: { always: true } },
      { name: 'b', type: 'string', required: {} },
      { name: 'c', type: 'string' },
    ])
    expect(fields.map(field => field.required)).toEqual([true, false, false])
  })

  it('accepte une absence totale d’inputs', () => {
    expect(translateSchema(undefined)).toEqual([])
  })

  it("n'invente pas de valeur par défaut absente", () => {
    const [field] = translateSchema([{ name: 'a', type: 'string' }])
    expect(field).not.toHaveProperty('default')
  })

  it('préserve toutes les entrées, y compris inconnues', () => {
    const inputs: ScenarioInput[] = [
      { name: 'a', type: 'string' },
      { name: 'b', type: 'inputs_array' },
      { name: 'c', type: 'model' },
    ]
    expect(translateSchema(inputs)).toHaveLength(3)
  })
})

describe('familyOf', () => {
  it('classe un modèle image-vers-vidéo en vidéo, pas en image', () => {
    expect(familyOf(['img2video', 'txt2video'])).toBe('video')
  })

  it('reconnaît la 3D, l’audio et l’image', () => {
    expect(familyOf(['img23d'])).toBe('3d')
    expect(familyOf(['txt2audio'])).toBe('audio')
    expect(familyOf(['txt2img', 'inpaint'])).toBe('image')
  })

  it('retombe sur « other » sans capacité exploitable', () => {
    expect(familyOf([])).toBe('other')
    expect(familyOf(undefined)).toBe('other')
    expect(familyOf(['txt2txt'])).toBe('other')
  })
})
