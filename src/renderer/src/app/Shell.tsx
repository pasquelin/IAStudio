import { DockviewReact, type DockviewApi, type DockviewReadyEvent } from 'dockview-react'
import { useCallback, useRef } from 'react'
import { TooltipHost } from '@/design/TooltipHost'
import { useLayouts } from '@/stores/layouts'
import { defaultSize, useTools } from '@/stores/tools'
import { DOCUMENT_COMPONENTS } from './documents'
import { Footer } from './Footer'
import { Rail } from './Rail'
import { ResizeHandle } from './ResizeHandle'
import { TitleBar } from './TitleBar'
import type { ToolId, ToolZone } from './tools'
import { Panel, ToolWindow } from './ToolWindow'
import 'dockview-react/dist/styles/dockview.css'
import './dockview-theme.css'

/**
 * Assemble le studio : rails d'icônes collés aux bords, fenêtres d'outils arrondies posées
 * sur la gouttière du châssis, Dockview au centre pour les seuls documents, et une ligne
 * d'état en pied.
 *
 * Le centre ne reçoit QUE des documents : un fichier ouvert et sa barre d'outils. Les
 * fenêtres d'outils vivent sur les bords, et n'y entrent jamais.
 */
export function Shell() {
  const activeWorkspace = useLayouts(state => state.activeWorkspace)
  const setActiveWorkspace = useLayouts(state => state.setActiveWorkspace)
  const open = useTools(state => state.open)
  const focusedZone = useTools(state => state.focusedZone)
  const toggle = useTools(state => state.toggle)
  const focus = useTools(state => state.focus)
  const api = useRef<DockviewApi | null>(null)

  const onReady = useCallback((event: DockviewReadyEvent) => {
    api.current = event.api
  }, [])

  const onToggle = useCallback((zone: ToolZone, tool: ToolId) => toggle(zone, tool), [toggle])

  return (
    <div className="bg-chassis flex h-full flex-col">
      <TitleBar activeWorkspace={activeWorkspace} onWorkspace={setActiveWorkspace} />

      <div className="flex min-h-0 flex-1">
        <Rail side="left" open={open} focusedZone={focusedZone} onToggle={onToggle} />

        {/* Les poignées occupent exactement la gouttière : l'espace entre deux surfaces EST
            la zone de redimensionnement, plutôt qu'un vide décoratif doublé d'une poignée. */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col py-(--sc-gutter)">
          <div className="flex min-h-0 flex-1">
            <VerticalEdge zone="left" />
            <Panel className="min-w-0 flex-1" onPointerDownCapture={() => focus(null)}>
              <DockviewReact components={DOCUMENT_COMPONENTS} onReady={onReady} />
            </Panel>
            <VerticalEdge zone="right" />
          </div>
          <HorizontalEdge zone="bottom" />
        </div>

        <Rail side="right" open={open} focusedZone={focusedZone} onToggle={onToggle} />
      </div>

      <Footer />
      <TooltipHost />
    </div>
  )
}

function useZoneParts(zone: ToolZone) {
  const openTool = useTools(state => state.open[zone] ?? null)
  const size = useTools(state => state.sizes[zone] ?? defaultSize(zone))
  const collapsed = useTools(state => state.collapsed[zone] ?? false)
  const close = useTools(state => state.close)
  const collapse = useTools(state => state.collapse)
  const focus = useTools(state => state.focus)
  const resize = useTools(state => state.resize)

  if (!openTool) return null

  return {
    panel: (
      <ToolWindow
        zone={zone}
        tool={openTool}
        size={size}
        collapsed={collapsed}
        onFocus={() => focus(zone)}
        onCollapse={() => collapse(zone)}
        onClose={() => close(zone)}
      />
    ),
    handle: collapsed ? null : (
      <ResizeHandle
        zone={zone}
        size={size}
        onSize={(value, available) => resize(zone, value, available)}
      />
    ),
  }
}

function VerticalEdge({ zone }: { zone: 'left' | 'right' }) {
  const parts = useZoneParts(zone)
  if (!parts) return null

  return zone === 'left' ? (
    <>
      {parts.panel}
      {parts.handle}
    </>
  ) : (
    <>
      {parts.handle}
      {parts.panel}
    </>
  )
}

function HorizontalEdge({ zone }: { zone: 'top' | 'bottom' }) {
  const parts = useZoneParts(zone)
  if (!parts) return null

  return zone === 'top' ? (
    <>
      {parts.panel}
      {parts.handle}
    </>
  ) : (
    <>
      {parts.handle}
      {parts.panel}
    </>
  )
}
