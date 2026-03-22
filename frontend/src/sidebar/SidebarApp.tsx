import { useState, useEffect, useRef, useCallback } from 'react'
import { ChatMessage } from './components/ChatMessage'
import { ChatInput } from './components/ChatInput'
import { RecordButton } from './components/RecordButton'
import { AgentverseDrawer } from './components/AgentverseDrawer'
import { useChatMessages } from './hooks/useChatMessages'
import { useSidebarSSE } from './hooks/useSidebarSSE'

const API_BASE =
  new URLSearchParams(window.location.search).get('api') ||
  'http://localhost:8000'

export function SidebarApp() {
  const { messages, addMessage, updateMessage, clear } = useChatMessages()
  const [isRecording, setIsRecording] = useState(false)
  const [showAgentverse, setShowAgentverse] = useState(false)
  const [activeApplicationId, setActiveApplicationId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const recordSessionRef = useRef<string | null>(null)

  // Wire SSE → chat messages
  useSidebarSSE(addMessage)

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Listen for postMessage from parent (loader)
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (!e.data?.type) return
      if (e.data.type === 'r4mi:opened') {
        if (e.data.activeApplicationId) {
          setActiveApplicationId(e.data.activeApplicationId)
        }
      }
      if (e.data.type === 'r4mi:source-confirmed') {
        const section = e.data.section as string
        addMessage('system', `Source confirmed: ${section || 'selected paragraph'}. Click "Confirm & continue" to apply.`)
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  // ── Actions from chat message buttons ──────────────────────────────────
  const activeApplicationIdRef = useRef<string | null>(null)
  activeApplicationIdRef.current = activeApplicationId

  const handleAction = useCallback(
    async (action: string, data: Record<string, unknown>) => {
      if (action === 'activate-agent') {
        const specId = data.id as string
        const specName = data.name as string
        if (!specId) return
        const sourceMsg = messages.find((m) => m.data?.id === specId && m.data?.event === 'AGENT_MATCH_FOUND')
        if (sourceMsg) {
          updateMessage(sourceMsg.id, { data: { _acted: true, _actedLabel: 'Activating...' } })
        }
        window.parent.postMessage(
          { type: 'r4mi:run-agent', specId, applicationId: activeApplicationIdRef.current },
          '*',
        )
        addMessage('system', `Running ${specName} on ${activeApplicationIdRef.current || 'current application'}...`)
        return
      }

      if (action === 'fork-agent') {
        const specId = data.id as string
        const sourceMsg = messages.find((m) => m.data?.id === specId && m.data?.event === 'AGENT_MATCH_FOUND')
        if (sourceMsg) {
          updateMessage(sourceMsg.id, { data: { _acted: true, _actedLabel: 'Forking...' } })
        }
        addMessage('system', 'Starting fork — building customised spec...')
        try {
          const res = await fetch(`${API_BASE}/api/agents/${specId}/tune`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          })
          const result = await res.json()
          if (result.spec) {
            addMessage('spec', `Forked spec ready: ${result.spec.name}`, {
              event: 'SPEC_GENERATED',
              spec: result.spec,
              session_id: result.spec.id,
            })
          }
        } catch (e) {
          addMessage('error', `Fork failed: ${e}`)
        }
        return
      }

      if (action === 'dismiss-match') {
        const specId = data.id as string
        const sourceMsg = messages.find((m) => m.data?.id === specId && m.data?.event === 'AGENT_MATCH_FOUND')
        if (sourceMsg) {
          updateMessage(sourceMsg.id, { data: { _acted: true, _actedLabel: 'Dismissed' } })
        }
        return
      }

      if (action === 'build-spec') {
        const sessionId = data.session_id as string
        if (!sessionId) return
        // Mark the notification as acted
        const sourceMsg = messages.find(
          (m) => m.data?.session_id === sessionId && m.data?.event === 'OPTIMIZATION_OPPORTUNITY',
        )
        if (sourceMsg) {
          updateMessage(sourceMsg.id, { data: { _acted: true, _actedLabel: 'Building spec...' } })
        }

        addMessage('system', 'Building agent spec from detected pattern...')

        try {
          const res = await fetch(`${API_BASE}/api/agents/build`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: sessionId }),
          })
          const result = await res.json()
          if (result.spec) {
            addMessage('replay', `Agent spec ready: ${result.spec.name}`, {
              event: 'SPEC_GENERATED',
              spec: result.spec,
              session_id: sessionId,
              action_sequence: result.spec.action_sequence,
            })
          } else {
            addMessage('error', 'Failed to build spec: ' + JSON.stringify(result))
          }
        } catch (e) {
          addMessage('error', `Build failed: ${e}`)
        }
      }

      if (action === 'replay-confirmed') {
        // User confirmed the replay — just acknowledge; correction sub-card is shown inline
        addMessage('system', '3 screens → 1 screen. Same result. Correct anything below, or skip to publish.')
        return
      }

      if (action === 'confirm-correction') {
        const sessionId = data.session_id as string
        const correction = data.correction as string
        addMessage('system', correction ? 'Applying correction and regenerating spec...' : 'Publishing without correction...')
        try {
          const res = await fetch(`${API_BASE}/api/agents/build`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: sessionId, correction }),
          })
          const result = await res.json()
          if (result.spec) {
            addMessage('spec', `Updated spec: ${result.spec.name}`, {
              event: 'SPEC_GENERATED',
              spec: result.spec,
              session_id: sessionId,
            })
          }
        } catch (e) {
          addMessage('error', `Spec update failed: ${e}`)
        }
        return
      }

      if (action === 'show-me') {
        addMessage('system', 'Navigate to the correct source and click the relevant paragraph.')
        window.parent.postMessage(
          { type: 'r4mi:show-me', targetTab: 'policy', demoMode: true },
          '*',
        )
        return
      }

      if (action === 'publish') {
        const sessionId = data.session_id as string
        if (!sessionId) return
        // Mark spec message as acted
        const sourceMsg = messages.find(
          (m) => m.data?.session_id === sessionId && m.data?.event === 'SPEC_GENERATED',
        )
        if (sourceMsg) {
          updateMessage(sourceMsg.id, { data: { _acted: true, _actedLabel: 'Publishing...' } })
        }

        addMessage('system', 'Publishing agent to Agentverse...')

        try {
          const res = await fetch(`${API_BASE}/api/agents/publish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: sessionId }),
          })
          const published = await res.json()
          addMessage('notification', `Agent published: ${published.name}`, {
            event: 'AGENT_PUBLISHED',
            ...published,
          })
        } catch (e) {
          addMessage('error', `Publish failed: ${e}`)
        }
      }
    },
    [messages, addMessage, updateMessage],
  )

  // ── Recording ──────────────────────────────────────────────────────────
  function handleRecordToggle() {
    const next = !isRecording
    setIsRecording(next)

    if (next) {
      const sessionId = `teach-${Date.now()}`
      recordSessionRef.current = sessionId
      window.parent.postMessage(
        { type: 'r4mi:set-session', sessionId, permitType: '' },
        '*',
      )
      addMessage('system', 'Recording started. Work through the workflow on the page. Click Stop when done.')
    } else {
      // Send a synthetic submit to finalize the session
      const sessionId = recordSessionRef.current
      if (sessionId) {
        fetch(`${API_BASE}/api/observe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            user_id: 'permit-tech-001',
            timestamp: new Date().toISOString(),
            event_type: 'submit',
            screen_name: 'TEACH_MODE_COMPLETE',
            element_selector: 'teach-stop-button',
            element_value: null,
          }),
        }).catch(() => {})
      }
      recordSessionRef.current = null
      window.parent.postMessage(
        { type: 'r4mi:set-session', sessionId: '' },
        '*',
      )
      addMessage('system', 'Recording stopped. Processing workflow — watch for pattern detection.')
    }
  }

  function handleAgentRun(specId: string, specName: string) {
    window.parent.postMessage(
      { type: 'r4mi:run-agent', specId, applicationId: activeApplicationId },
      '*',
    )
    setShowAgentverse(false)
    addMessage('system', `Running ${specName} on ${activeApplicationId || 'current application'}...`)
  }

  if (showAgentverse) {
    return (
      <AgentverseDrawer
        onClose={() => setShowAgentverse(false)}
        activeApplicationId={activeApplicationId}
        onRun={handleAgentRun}
      />
    )
  }

  return (
    <div style={root}>
      {/* Header */}
      <div style={header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ color: '#6366f1', fontWeight: 700, fontSize: 14 }}>r4mi-ai</div>
          <RecordButton isRecording={isRecording} onToggle={handleRecordToggle} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => setShowAgentverse((v) => !v)}
            style={headerBtn}
            title="Browse agents"
          >
            Agents
          </button>
          <button
            onClick={() => window.parent.postMessage({ type: 'r4mi:close' }, '*')}
            style={closeBtn}
          >
            x
          </button>
        </div>
      </div>

      {/* Messages */}
      <div style={messageList}>
        {messages.map((msg) => (
          <ChatMessage key={msg.id} msg={msg} onAction={handleAction} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <ChatInput
        addMessage={addMessage}
        isRecording={isRecording}
        setIsRecording={setIsRecording}
        onToggleAgentverse={() => setShowAgentverse((v) => !v)}
      />
    </div>
  )
}

const root: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  background: '#0f1117',
  fontFamily: 'Inter, system-ui, sans-serif',
  color: '#e2e8f0',
}

const header: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '10px 12px',
  borderBottom: '1px solid #2d3149',
  flexShrink: 0,
}

const headerBtn: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid #2d3149',
  color: '#94a3b8',
  padding: '4px 10px',
  cursor: 'pointer',
  fontSize: 11,
  fontWeight: 600,
  borderRadius: 4,
  fontFamily: 'Inter, system-ui, sans-serif',
}

const closeBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#4a5568',
  cursor: 'pointer',
  fontSize: 18,
  lineHeight: 1,
}

const messageList: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '8px 12px',
}
