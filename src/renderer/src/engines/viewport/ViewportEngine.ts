import { ViewportFrame } from './ViewportFrame'

export { INSET_CADENCE_MS } from './viewportEngineSupport1'
export type {
  ViewportEngineOptions,
  DrawSurface,
  DrawRequest,
  ViewportOutput,
  ProjectionKind,
  ViewportCamera,
  InsetPane,
} from './viewportEngineSupport1'

export class ViewportEngine extends ViewportFrame {}
