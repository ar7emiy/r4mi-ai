import { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  flowchart: { curve: 'basis' },
  themeVariables: {
    background: '#111827',
    primaryColor: '#1e293b',
    primaryTextColor: '#e2e8f0',
    lineColor: '#4b5563',
    secondaryColor: '#1e293b',
    tertiaryColor: '#1e293b',
  },
})

let diagramCount = 0

export function SystemDiagram() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const render = async () => {
      try {
        // Load the .mermaid file from the public assets
        const res = await fetch('/src/assets/system-diagram.mermaid')
        if (!res.ok) throw new Error(`Failed to load diagram: ${res.status}`)
        const diagram = await res.text()

        if (cancelled || !containerRef.current) return

        diagramCount++
        const id = `mermaid-diagram-${diagramCount}`
        const { svg } = await mermaid.render(id, diagram)

        if (cancelled || !containerRef.current) return
        containerRef.current.innerHTML = svg
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Diagram render failed')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    render()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">System Architecture</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          UML activity diagram — 3 swimlanes: Permit Tech · r4mi-ai Observer · Narrow-Agentverse
        </p>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-700 p-4 overflow-auto min-h-[400px]">
        {loading && (
          <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
            Rendering diagram…
          </div>
        )}
        {error && (
          <div className="flex items-center justify-center h-48 text-red-400 text-sm">
            {error}
          </div>
        )}
        <div ref={containerRef} className="[&>svg]:max-w-full [&>svg]:h-auto" />
      </div>
    </div>
  )
}
