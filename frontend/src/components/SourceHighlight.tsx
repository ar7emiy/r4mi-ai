import { useEffect, useRef } from 'react'
import { useR4miStore, type HighlightRegion } from '@/store/r4mi.store'

const REGION_TYPE_COLORS: Record<string, { glow: string; badge: string }> = {
  gis_data:          { glow: 'rgba(34,197,94,0.35)',  badge: 'bg-green-500/20 text-green-300 border-green-500/40' },
  violation_history: { glow: 'rgba(239,68,68,0.35)',  badge: 'bg-red-500/20 text-red-300 border-red-500/40' },
  policy_text:       { glow: 'rgba(168,85,247,0.35)', badge: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
  email_thread:      { glow: 'rgba(59,130,246,0.35)', badge: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
  pdf_excerpt:       { glow: 'rgba(249,115,22,0.35)', badge: 'bg-orange-500/20 text-orange-300 border-orange-500/40' },
  notes:             { glow: 'rgba(234,179,8,0.35)',  badge: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40' },
}

const DEFAULT_COLOR = { glow: 'rgba(99,102,241,0.35)', badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' }

interface HighlightOverlayProps {
  region: HighlightRegion
}

function HighlightOverlay({ region }: HighlightOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const colors = REGION_TYPE_COLORS[region.region_type ?? ''] ?? DEFAULT_COLOR

  useEffect(() => {
    // Find the element in the DOM matching the selector
    const target = document.querySelector(region.element_selector) as HTMLElement | null
    if (!target || !overlayRef.current) return

    const update = () => {
      const rect = target.getBoundingClientRect()
      const overlay = overlayRef.current!
      overlay.style.top = `${rect.top + window.scrollY}px`
      overlay.style.left = `${rect.left + window.scrollX}px`
      overlay.style.width = `${rect.width}px`
      overlay.style.height = `${rect.height}px`
      overlay.style.display = rect.width === 0 ? 'none' : 'block'
    }

    update()
    // Re-position on scroll/resize
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [region.element_selector])

  return (
    <div
      ref={overlayRef}
      className="fixed pointer-events-none z-40 rounded-sm transition-all duration-300 group"
      style={{
        boxShadow: `0 0 0 2px ${colors.glow}, 0 0 16px ${colors.glow}`,
      }}
    >
      {/* Tooltip */}
      <div
        className={`absolute -top-8 left-0 whitespace-nowrap px-2 py-0.5 rounded-md
                    border text-[11px] font-medium flex items-center gap-1.5 ${colors.badge}`}
      >
        <span>r4mi-ai</span>
        <span className="opacity-60">·</span>
        <span>{(region.region_type ?? 'source').replace(/_/g, ' ')}</span>
        <span className="opacity-60">·</span>
        <span className="font-semibold">{Math.round(region.confidence * 100)}%</span>
      </div>
    </div>
  )
}

/**
 * SourceHighlight renders highlight overlays on unstructured text regions
 * identified by Gemini Vision. It positions them over the matching DOM elements
 * using fixed positioning relative to the document.
 *
 * Requirements:
 * - CaseFile.tsx sections must have [data-source-id="..."] attributes matching
 *   the element_selectors returned by Gemini Vision.
 */
export function SourceHighlight() {
  const { highlightRegions, showSourceHighlight } = useR4miStore()

  if (!showSourceHighlight || highlightRegions.length === 0) return null

  return (
    <>
      {highlightRegions.map((region, idx) => (
        <HighlightOverlay key={`${region.screen_name}-${idx}`} region={region} />
      ))}
    </>
  )
}
