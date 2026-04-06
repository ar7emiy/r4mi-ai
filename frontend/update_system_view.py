import re

with open("src/sidebar/SidebarApp.tsx", "r", encoding="utf-8") as f:
    code = f.read()

# Add captureLogs state
state_repl = """  const [tab, setTab] = useState<'chat'|'activity'>('chat')
  const [captureLogs, setCaptureLogs] = useState<Array<any>>([])
"""
code = code.replace("  const [tab, setTab] = useState<'chat'|'activity'>('chat')", state_repl)

# Update r4mi:capture-live handler
capture_live_repl = """      if (e.data.type === 'r4mi:capture-live') {
        const d = e.data.detail as { type: string; text?: string; label?: string; screen?: string; role?: string, position?: {x: number, y: number} };
        if (d.type === 'action' || d.type === 'narration' || d.type === 'screenshot') {
          setCaptureLogs(prev => [...prev, { id: Date.now() + Math.random(), ts: Date.now(), ...d }]);
        }
        setRecording((prev) => ({
"""
code = code.replace("""      if (e.data.type === 'r4mi:capture-live') {
        const d = e.data.detail as { type: string; text?: string; label?: string; screen?: string; role?: string }
        setRecording((prev) => ({""", capture_live_repl)

# Separate System View Render out of mainArea
main_area_repl = """
      {/* Main content area */}
      {tab === 'activity' ? (
        <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8, background: CLR.bg }}>
          <div style={{ fontSize: 13, fontWeight: 'bold', color: CLR.accent, marginBottom: 8, textTransform: 'uppercase' }}>── System Telemetry & Insights ──</div>
          <div style={{ fontSize: 11, color: CLR.dim, marginBottom: 12 }}>Real-time streaming of LLM actions, DOM activity, and tracking.</div>
          
          {captureLogs.length === 0 && <div style={{ color: CLR.dim, fontSize: 11 }}>No activity captured yet. Start recording to see telemetry.</div>}
          
          {captureLogs.map((log, i) => (
            <div key={log.id} style={{ padding: '8px 12px', background: CLR.surface, border: `1px solid ${CLR.border}`, borderRadius: 4, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
               <div style={{ color: CLR.dim, fontSize: 10, paddingTop: 2, minWidth: 60 }}>{new Date(log.ts).toISOString().split('T')[1].slice(0,8)}</div>
               <div style={{ flex: 1 }}>
                 {log.type === 'action' && (
                   <>
                     <span style={{ color: CLR.accent, fontWeight: 600, fontSize: 11 }}>[DOM_CLICK]</span> 
                     <span style={{ color: CLR.text, fontSize: 11, marginLeft: 6 }}>{log.role?.toUpperCase()} {log.label ? `"${log.label}"` : ''} on {log.screen}</span>
                     {log.position && <div style={{ color: CLR.dim, fontSize: 10, marginTop: 4 }}>► pixel coordinates: x={log.position.x}, y={log.position.y}</div>}
                   </>
                 )}
                 {log.type === 'narration' && (
                   <>
                     <span style={{ color: CLR.green, fontWeight: 600, fontSize: 11 }}>[VOICE_INPUT]</span> 
                     <span style={{ color: CLR.text, fontSize: 11, marginLeft: 6, fontStyle: 'italic' }}>"{log.text}"</span>
                   </>
                 )}
                 {log.type === 'screenshot' && (
                   <>
                     <span style={{ color: CLR.amber, fontWeight: 600, fontSize: 11 }}>[SCREEN_CAPTURE]</span> 
                     <span style={{ color: CLR.dim, fontSize: 11, marginLeft: 6 }}>Snapshot saved to trace memory</span>
                   </>
                 )}
               </div>
            </div>
          ))}
          {/* Also show system chat messages */}
          {messages.filter(m => m.type === 'system' || m.type === 'spec').map((m, i) => (
            <div key={m.id} style={{ padding: '8px 12px', background: CLR.bg, borderLeft: `2px solid ${CLR.accent}`, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
               <div style={{ color: CLR.dim, fontSize: 10, paddingTop: 2, minWidth: 60 }}>{new Date(m.timestamp).toISOString().split('T')[1].slice(0,8)}</div>
               <div style={{ flex: 1 }}>
                 <span style={{ color: CLR.amber, fontWeight: 600, fontSize: 11 }}>[LLM_THOUGHT]</span> 
                 <div style={{ color: CLR.text, fontSize: 11, marginTop: 4, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>{m.text}</div>
               </div>
            </div>
          ))}
          <div ref={logsEndRef} />
        </div>
      ) : (
      <div style={mainArea}>
"""
code = code.replace("""      {/* Main content area */}
      <div style={mainArea}>""", main_area_repl)

# Hide ChatInput when not in chat
footer_repl = """      {/* Footer — teach me + command input */}
      {tab === 'chat' && (
        <ChatInput addMessage={addMessage} isRecording={recording.active} setIsRecording={() => phase === 'recording' ? stopRecording() : startRecording()} onToggleAgentverse={() => setPhase('agents')} />
      )}
      {tab === 'activity' && (
        <div style={{ borderTop: `1px solid ${CLR.border}`, padding: 8, background: CLR.bg }}></div>
      )}
    </div>
"""
code = re.sub(r"      \{/\* Footer — teach me \+ command input \*/\}.*?    </div>", footer_repl, code, flags=re.DOTALL)

# Delete the double logArea rendering
chat_message_filter = """              {messages.filter(m => m.type !== 'system' && m.type !== 'notification' && m.type !== 'error' && m.type !== 'agent-step').map((m) => (
                <ChatMessageComponent key={m.id} msg={m} />
              ))}"""
code = re.sub(r"              \{tab === 'chat' \? messages.*?\}\)\)}", chat_message_filter, code, flags=re.DOTALL)

with open("src/sidebar/SidebarApp.tsx", "w", encoding="utf-8") as f:
    f.write(code)

print("done")
