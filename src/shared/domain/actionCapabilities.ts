import type { DocumentKind } from './document'
import type { TargetKind } from './target'

export type ActionIntent =
  'read' | 'create' | 'mutate' | 'delete' | 'search' | 'execute' | 'remember'
export type ActionDocumentAffinity = 'required' | 'relevant' | 'transversal'
export type ActionTarget =
  | TargetKind
  | 'asset'
  | 'component'
  | 'document'
  | 'file'
  | 'generation'
  | 'job'
  | 'memory'
  | 'project'
  | 'projectContext'
  | 'studio'
  | 'timeline'

export type ActionCapabilities = {
  intents?: readonly ActionIntent[]
  targets?: readonly ActionTarget[]
  documentKinds?: readonly DocumentKind[]
  documentAffinity?: ActionDocumentAffinity
}
