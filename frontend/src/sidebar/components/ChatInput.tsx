import { useState, useRef } from 'react'
import type { MessageType } from '../hooks/useChatMessages'

const API_BASE =
  new URLSearchParams(window.location.search).get('api') ||
  'http://localhost:8000'

interface Props {
  addMessage: (type: MessageType, text: string, data?: Record<string, unknown>) => void
  isRecording: boolean
  setIsRecording: (v: boolean) => void
  onToggleAgentverse: () => void
}

export function ChatInput({ addMessage, isRecording, setIsRecording, onToggleAgentverse }: Props) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleSubmit() {
    const text = value.trim()
    if (!text) return
    setValue('')

    // /commands
    if (text.startsWith('/')) {
      const parts = text.split(/\s+/)
      const cmd = parts[0].toLowerCase()

      switch (cmd) {
        case '/agents':
          onToggleAgentverse()
          return

        case '/record':
          handleRecordToggle()
          return

        case '/debug':
          addMessage('system', 'Debug mode not yet available in sidebar.')
          return

        case '/help':
          addMessage('system', [
            'Available commands:',
            '  /agents — browse available agents',
            '  /record — toggle teach-me recording',
            '  /{agent-name} {app-id} — run an agent',
            '  /suggest-flow — get automation suggestions',
            '  /help — show this message',
          ].join('\n'))
          return

        case '/suggest-flow':
          addMessage('user', text)
          try {
            const res = await fetch(`${API_BASE}/api/chat`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ message: text }),
            })
            const data = await res.json()
            if (data.reply) {
              addMessage('system', data.reply)
            }
          } catch { }
          return

        default: {
          // Try to match /{agent-slug} {application-id}
          const agentSlug = cmd.slice(1)
          const appId = parts[1]
          if (agentSlug && appId) {
            await runAgentBySlug(agentSlug, appId)
          } else if (agentSlug) {
            addMessage('system', `Usage: /${agentSlug} <application-id>`)
          }
          return
        }
      }
    }

    // Regular chat message — send to backend for AI response
    addMessage('user', text)
    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })
      const data = await res.json()
      if (data.reply) {
        addMessage('system', data.reply)
      }
    } catch {
      // Non-fatal — chat responses are best-effort
    }
  }

  function handleRecordToggle() {
    const next = !isRecording
    setIsRecording(next)

    if (next) {
      const sessionId = `teach-${Date.now()}`
      window.parent.postMessage(
        { type: 'r4mi:set-session', sessionId, permitType: '' },
        '*',
      )
      addMessage('system', 'Recording started. Work through the workflow on the page. Type annotations here as you go.')
    } else {
      window.parent.postMessage(
        { type: 'r4mi:set-session', sessionId: '' },
        '*',
      )
      addMessage('system', 'Recording stopped. Processing workflow...')
    }
  }

  async function runAgentBySlug(slug: string, applicationId: string) {
    addMessage('system', `Looking for agent "${slug}"...`)
    try {
      const res = await fetch(`${API_BASE}/api/agents`)
      const agents = await res.json()
      const match = agents.find(
        (a: { name: string; id: string }) =>
          a.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').includes(slug) ||
          a.id.startsWith(slug),
      )
      if (!match) {
        addMessage('error', `No agent found matching "${slug}". Type /agents to browse.`)
        return
      }
      addMessage('system', `Running agent "${match.name}" on ${applicationId}...`)
      await fetch(
        `${API_BASE}/api/agents/${match.id}/run?application_id=${encodeURIComponent(applicationId)}`,
        { method: 'POST' },
      )
      // Steps will arrive via SSE
    } catch (e) {
      addMessage('error', `Failed to run agent: ${e}`)
    }
  }


  const showCommands = value.startsWith('/');

  return (
    <div style={{...container, position: 'relative', flexDirection: 'column', gap: 0}}>
      {showCommands && (
        <div style={{position: 'absolute', bottom: '100%', left: 0, right: 0, background: '#1e1b4b', border: '1px solid #6366f1', borderRadius: '4px 4px 0 0', padding: '8px', zIndex: 10, maxHeight: 200, overflowY: 'auto'}}>
          <div style={{fontSize: 10, fontWeight: 'bold', color: '#6366f1', marginBottom: 4, textTransform: 'uppercase'}}>Agents</div>
          <div style={{fontSize: 11, padding: '4px 8px', color: '#e2e8f0', cursor: 'pointer', borderBottom: '1px solid #2d3149'}} onClick={() => setValue('/agents')}>/agents — browse available agents</div>
          <div style={{fontSize: 11, padding: '4px 8px', color: '#e2e8f0', cursor: 'pointer', borderBottom: '1px solid #2d3149'}} onClick={() => setValue('/{agent-name} {app-id}')}>/&#123;agent-name&#125; &#123;app-id&#125; — run an agent</div>
          
          <div style={{fontSize: 10, fontWeight: 'bold', color: '#6366f1', marginTop: 8, marginBottom: 4, textTransform: 'uppercase'}}>Other commands</div>
          <div style={{fontSize: 11, padding: '4px 8px', color: '#e2e8f0', cursor: 'pointer', borderBottom: '1px solid #2d3149'}} onClick={() => setValue('/suggest-flow')}>/suggest-flow — get automation suggestions</div>
          <div style={{fontSize: 11, padding: '4px 8px', color: '#e2e8f0', cursor: 'pointer', borderBottom: '1px solid #2d3149'}} onClick={() => setValue('/record')}>/record — toggle teach-me recording</div>
          <div style={{fontSize: 11, padding: '4px 8px', color: '#e2e8f0', cursor: 'pointer'}} onClick={() => setValue('/help')}>/help — show help message</div>
        </div>
      )}
      <div style={{display: 'flex', gap: 6, width: '100%', paddingTop: 8}}>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit()
          }}
          placeholder={isRecording ? 'Type an annotation...' : 'Type a message or /command...'}
          style={input}
        />
        <button onClick={handleSubmit} style={sendBtn}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>
    </div>
  )

}

const container: React.CSSProperties = {
  display: 'flex',
  gap: 6,
  padding: '8px 12px',
  borderTop: '1px solid #2d3149',
  background: '#0f1117',
}

const input: React.CSSProperties = {
  flex: 1,
  background: '#1a1d27',
  border: '1px solid #2d3149',
  borderRadius: 4,
  color: '#e2e8f0',
  padding: '8px 10px',
  fontSize: 13,
  fontFamily: 'Inter, system-ui, sans-serif',
  outline: 'none',
}

const sendBtn: React.CSSProperties = {
  background: '#6366f1',
  border: 'none',
  color: '#fff',
  padding: '6px 10px',
  borderRadius: 4,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}
