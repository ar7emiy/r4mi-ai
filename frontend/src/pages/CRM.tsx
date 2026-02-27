import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useR4miStore } from '@/store/r4mi.store'
import { eventTracker } from '@/lib/eventTracker'
import CaseFile from '@/components/CaseFile'
import ActionForm from '@/components/ActionForm'
import { ArrowLeft, Camera, CameraOff, Zap } from 'lucide-react'

export type Scenario = 'billing_refund' | 'account_cancellation'

const SCENARIO_LABELS: Record<Scenario, string> = {
  billing_refund: 'Billing Refund #48291',
  account_cancellation: 'Account Cancellation #48292',
}

export default function CRM() {
  const { sessionId, sseConnected } = useR4miStore()
  const [scenario, setScenario] = useState<Scenario>('billing_refund')
  const [captureActive, setCaptureActive] = useState(false)
  const [eventCount, setEventCount] = useState(0)
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null)
  const crmRef = useRef<HTMLDivElement>(null)

  // Always track events once a session is connected
  useEffect(() => {
    if (sessionId && sseConnected) {
      eventTracker.setSession(sessionId)
      eventTracker.start()
    } else {
      eventTracker.stop()
    }
  }, [sessionId, sseConnected])

  // Update event count
  useEffect(() => {
    if (!captureActive) return
    const interval = setInterval(() => {
      setEventCount(eventTracker.getEventCount())
    }, 1000)
    return () => clearInterval(interval)
  }, [captureActive])

  // Sync captureActive with tracker state
  useEffect(() => {
    setCaptureActive(sseConnected && !!sessionId)
  }, [sseConnected, sessionId])

  // Manually toggle capture
  function toggleCapture() {
    if (!sessionId) return
    if (captureActive) {
      eventTracker.stop()
      setCaptureActive(false)
    } else {
      eventTracker.setSession(sessionId)
      eventTracker.start()
      setCaptureActive(true)
    }
  }

  const ticketId = scenario === 'billing_refund' ? '#48291' : '#48292'
  const priority = 'HIGH'
  const customerName = scenario === 'billing_refund' ? 'Maria Santos' : 'James Chen'

  return (
    <div className="flex h-screen flex-col bg-white">
      {/* Top bar — enterprise CRM style */}
      <header className="flex items-center gap-3 border-b bg-gray-900 px-4 py-2.5 text-white">
        <Zap className="h-4 w-4 text-blue-400" />
        <span className="font-semibold text-sm">SupportDesk Pro</span>
        <Separator orientation="vertical" className="h-4 bg-gray-600" />

        {/* Scenario tabs */}
        <div className="flex items-center gap-1">
          {(Object.entries(SCENARIO_LABELS) as [Scenario, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setScenario(key)}
              className={[
                'rounded px-3 py-1 text-xs transition-colors',
                scenario === key
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div className="text-xs text-gray-300">
            Ticket <span className="font-mono font-medium text-white">{ticketId}</span>
            <span className="ml-2 rounded bg-red-600 px-1.5 py-0.5 text-xs">{priority}</span>
          </div>
          <div className="text-xs text-gray-400">{customerName}</div>
          <Separator orientation="vertical" className="h-4 bg-gray-600" />
          <Link to="/">
            <button className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white transition-colors">
              <ArrowLeft className="h-3.5 w-3.5" />
              Factory
            </button>
          </Link>
        </div>
      </header>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 border-b bg-gray-50 px-4 py-1.5 text-xs text-muted-foreground">
        <span>Tickets</span>
        <span>›</span>
        <span>All Tickets</span>
        <span>›</span>
        <span className="font-medium text-foreground">{ticketId} — {customerName}</span>
      </div>

      {/* Main: case file + form side by side */}
      <div ref={crmRef} className="flex flex-1 overflow-hidden" id="crm-workspace">
        {/* Left: Case File — the messy document */}
        <div className="flex w-[58%] flex-col overflow-auto border-r">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-4 py-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Case File</span>
              <Badge variant="outline" className="text-xs">Read-only</Badge>
            </div>
            <span className="text-xs text-muted-foreground">Submitted {scenario === 'billing_refund' ? 'Nov 18, 2024' : 'Jan 15, 2025'}</span>
          </div>
          <CaseFile scenario={scenario} activeFieldId={activeFieldId} />
        </div>

        {/* Right: Action Form — structured fields */}
        <div className="flex w-[42%] flex-col overflow-auto">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-4 py-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Resolution Form</span>
              <Badge variant="secondary" className="text-xs">Agent Input</Badge>
            </div>
            <span className="text-xs text-muted-foreground">{scenario === 'billing_refund' ? 'Billing Refund' : 'Account Cancellation'}</span>
          </div>
          <ActionForm
            scenario={scenario}
            sessionId={sessionId}
            onFieldFocus={setActiveFieldId}
            onFieldBlur={() => setActiveFieldId(null)}
            onFieldChange={(fieldId, value) => {
              eventTracker.track({
                type: 'input',
                target_id: fieldId,
                value,
              })
            }}
            onSubmit={() => {
              eventTracker.track({ type: 'submit', target_id: 'resolution-form' })
            }}
          />
        </div>
      </div>

      {/* Bottom: capture status bar */}
      <div className="flex items-center justify-between border-t bg-gray-50 px-4 py-2 text-xs">
        <div className="flex items-center gap-3">
          {sessionId ? (
            <span className="text-muted-foreground">
              Session: <code className="font-mono text-foreground">{sessionId}</code>
            </span>
          ) : (
            <span className="text-muted-foreground italic">No active session — open the Factory to start</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {captureActive && (
            <span className="flex items-center gap-1.5 text-amber-700">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
              Recording — {eventCount} event{eventCount !== 1 ? 's' : ''} captured
            </span>
          )}
          {sessionId && (
            <Button
              variant={captureActive ? 'outline' : 'ghost'}
              size="sm"
              className={captureActive ? 'border-amber-300 text-amber-700 hover:bg-amber-50' : 'text-muted-foreground'}
              onClick={toggleCapture}
            >
              {captureActive ? (
                <><CameraOff className="h-3.5 w-3.5" /> Stop Capture</>
              ) : (
                <><Camera className="h-3.5 w-3.5" /> Manual Capture</>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
