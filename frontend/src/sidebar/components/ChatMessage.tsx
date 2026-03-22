import type { ChatMessage as ChatMsg } from '../hooks/useChatMessages'
import { ReplayPreview } from './ReplayPreview'

interface Props {
  msg: ChatMsg
  onAction?: (action: string, data: Record<string, unknown>) => void
}

export function ChatMessage({ msg, onAction }: Props) {
  const style = messageStyles[msg.type] ?? messageStyles.system

  const event = msg.data?.event as string | undefined

  const isAgentStep = msg.type === 'agent-step'

  return (
    <div
      style={{ ...baseMsg, ...style }}
      data-testid={isAgentStep ? 'approval-gate' : undefined}
    >
      {msg.type === 'error' && <span style={errorDot} />}
      {msg.type === 'notification' && <span style={notifDot} />}

      <div style={{ fontSize: 12, lineHeight: 1.5 }}>{msg.text}</div>

      {/* Actionable buttons based on SSE event type */}
      {event === 'AGENT_MATCH_FOUND' && !msg.data?._acted && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 12 }}>
              {msg.data?.name as string}
            </span>
            <span style={{ fontSize: 10, color: '#94a3b8' }}>{msg.data?.permit_type as string}</span>
          </div>
          {/* Match score bar */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ height: 4, background: '#2d3149', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${Math.round((msg.data?.score as number ?? 0) * 100)}%`,
                background: '#22c55e',
                borderRadius: 2,
              }} />
            </div>
            <div style={{ fontSize: 10, color: '#22c55e', marginTop: 2 }}>
              {Math.round((msg.data?.score as number ?? 0) * 100)}% match
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              style={{ ...actionBtn, background: '#22c55e' }}
              onClick={() => onAction?.('activate-agent', msg.data ?? {})}
            >
              Activate Agent
            </button>
            <button
              style={{ ...actionBtn, background: 'transparent', border: '1px solid #6366f1', color: '#6366f1' }}
              onClick={() => onAction?.('fork-agent', msg.data ?? {})}
            >
              Fork &amp; Customise
            </button>
            <button
              style={{ background: 'none', border: 'none', color: '#4a5568', fontSize: 11, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}
              onClick={() => onAction?.('dismiss-match', msg.data ?? {})}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {event === 'OPTIMIZATION_OPPORTUNITY' && !msg.data?._acted && (
        <button
          style={actionBtn}
          onClick={() => onAction?.('build-spec', msg.data ?? {})}
        >
          Build Agent from Pattern
        </button>
      )}

      {msg.type === 'replay' && !msg.data?._acted && (
        <ReplayPreview
          steps={(msg.data?.action_sequence as Array<Record<string, unknown>> ?? []) as Parameters<typeof ReplayPreview>[0]['steps']}
          sessionId={msg.data?.session_id as string ?? ''}
          onConfirmed={() => onAction?.('replay-confirmed', msg.data ?? {})}
          onSkip={(sid) => onAction?.('publish', { ...msg.data, session_id: sid })}
          onCorrect={(sid, correction) => onAction?.('confirm-correction', { ...msg.data, session_id: sid, correction })}
          onShowMe={(sid) => onAction?.('show-me', { ...msg.data, session_id: sid })}
        />
      )}

      {event === 'SPEC_GENERATED' && msg.type !== 'replay' && !msg.data?._acted && (
        <div>
          {renderSpec(msg.data?.spec as Record<string, unknown>)}
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button
              style={actionBtn}
              onClick={() => onAction?.('publish', msg.data ?? {})}
            >
              Publish Agent
            </button>
          </div>
        </div>
      )}

      {event === 'AGENT_PUBLISHED' && (
        <div style={{ marginTop: 6, fontSize: 11, color: '#22c55e' }}>
          Agent is now available in the Agentverse.
        </div>
      )}

      {isAgentStep && !msg.data?._acted && (
        <button
          data-testid="approval-gate-approve"
          style={{ ...actionBtn, marginTop: 6 }}
          onClick={() => onAction?.('approve-step', msg.data ?? {})}
        >
          Looks good — continue
        </button>
      )}

      {msg.data?._acted && (
        <div style={{ marginTop: 4, fontSize: 10, color: '#4a5568', fontStyle: 'italic' }}>
          {msg.data._actedLabel as string || 'Done'}
        </div>
      )}

      <div style={timestamp}>
        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  )
}

function renderSpec(spec: Record<string, unknown> | undefined) {
  if (!spec) return null
  const actions = (spec.action_sequence ?? []) as Array<Record<string, unknown>>
  const sources = (spec.knowledge_sources ?? []) as Array<Record<string, unknown>>
  return (
    <div style={{
      background: '#1a1d27',
      border: '1px solid #2d3149',
      borderRadius: 4,
      padding: 10,
      marginTop: 8,
      fontSize: 11,
    }}>
      <div style={{ fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>{spec.name as string}</div>
      <div style={{ color: '#94a3b8', marginBottom: 8 }}>{spec.description as string}</div>
      {actions.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ color: '#4a5568', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', marginBottom: 4 }}>Steps</div>
          {actions.map((s, i) => (
            <div key={i} style={{ color: '#94a3b8', marginBottom: 2 }}>
              <span style={{ color: '#6366f1', fontWeight: 700 }}>{s.step as number}.</span>{' '}
              {s.description as string || s.action as string}
              <span style={{ color: '#6366f1', fontSize: 10 }}> ({s.source as string})</span>
            </div>
          ))}
        </div>
      )}
      {sources.length > 0 && (
        <div>
          <div style={{ color: '#4a5568', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', marginBottom: 4 }}>Sources</div>
          {sources.map((s, i) => (
            <div key={i} style={{ color: '#94a3b8', marginBottom: 2 }}>
              <span style={{ color: '#22c55e' }}>+</span> {s.name as string} — {s.reference as string}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const baseMsg: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 6,
  marginBottom: 6,
  position: 'relative',
}

const messageStyles: Record<string, React.CSSProperties> = {
  system: {
    background: '#1a1d27',
    color: '#94a3b8',
    borderLeft: '2px solid #2d3149',
  },
  user: {
    background: '#1e1b4b',
    color: '#e2e8f0',
    borderLeft: '2px solid #6366f1',
  },
  notification: {
    background: 'rgba(99, 102, 241, 0.08)',
    color: '#e2e8f0',
    border: '1px solid rgba(99, 102, 241, 0.25)',
  },
  match: {
    background: 'rgba(34, 197, 94, 0.06)',
    color: '#e2e8f0',
    border: '1px solid rgba(34, 197, 94, 0.2)',
  },
  replay: {
    background: '#1a1d27',
    color: '#e2e8f0',
    borderLeft: '3px solid #6366f1',
  },
  spec: {
    background: 'rgba(34, 197, 94, 0.06)',
    color: '#e2e8f0',
    border: '1px solid rgba(34, 197, 94, 0.2)',
  },
  'agent-step': {
    background: '#1a1d27',
    color: '#e2e8f0',
    borderLeft: '2px solid #6366f1',
    fontFamily: 'monospace',
  },
  error: {
    background: 'rgba(220, 38, 38, 0.08)',
    color: '#fca5a5',
    border: '1px solid rgba(220, 38, 38, 0.3)',
  },
}

const timestamp: React.CSSProperties = {
  fontSize: 10,
  color: '#4a5568',
  marginTop: 4,
}

const errorDot: React.CSSProperties = {
  display: 'inline-block',
  width: 6,
  height: 6,
  borderRadius: '50%',
  background: '#dc2626',
  marginRight: 6,
  verticalAlign: 'middle',
}

const notifDot: React.CSSProperties = {
  display: 'inline-block',
  width: 6,
  height: 6,
  borderRadius: '50%',
  background: '#6366f1',
  marginRight: 6,
  verticalAlign: 'middle',
}

const actionBtn: React.CSSProperties = {
  marginTop: 8,
  background: '#6366f1',
  border: 'none',
  color: '#fff',
  padding: '5px 12px',
  cursor: 'pointer',
  fontSize: 11,
  fontWeight: 600,
  borderRadius: 3,
  fontFamily: 'Inter, system-ui, sans-serif',
}
