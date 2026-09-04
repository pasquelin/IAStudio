export type ActionResource = 'generationModelCandidates' | 'preparedGeneration'

export type ActionReferenceKind = 'model' | 'asset' | 'node' | 'document' | 'job'

export type ActionResourceDescriptor = {
  reference?: { kind: ActionReferenceKind; key: string }
}

export const ACTION_RESOURCES: Record<ActionResource, ActionResourceDescriptor> = {
  generationModelCandidates: { reference: { kind: 'model', key: 'id' } },
  preparedGeneration: {},
}
