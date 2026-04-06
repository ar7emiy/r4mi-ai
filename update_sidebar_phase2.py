import re

with open("frontend/src/sidebar/SidebarApp.tsx", "r", encoding="utf-8") as f:
    code = f.read()

# 1. Add new states and methods
additions = """
  const [isDark, setIsDark] = useState(true)
  const [tab, setTab] = useState<'chat'|'activity'>('chat')
  const [isRecordingPaused, setIsRecordingPaused] = useState(localStorage.getItem('r4mi_pause_recording') === 'true')

  const toggleRecordingPause = () => {
    const next = !isRecordingPaused
    setIsRecordingPaused(next)
    if (next) localStorage.setItem('r4mi_pause_recording', 'true')
    else localStorage.removeItem('r4mi_pause_recording')
  }

  const CLR = isDark ? {
    bg: '#09090b',
    surface: '#18181b',
    border: '#27272a',
    text: '#f4f4f5',
    dim: '#a1a1aa',
    accent: '#FF7E67',
    green: '#10b981',
    amber: '#f59e0b',
    red: '#ef4444',
  } : {
    bg: '#f8fafc',
    surface: '#ffffff',
    border: '#e2e8f0',
    text: '#0f172a',
    dim: '#64748b',
    accent: '#FF7E67',
    green: '#059669',
    amber: '#d97706',
    red: '#dc2626',
  }
"""
code = re.sub(r"  const \[phase, setPhase\] = useState<Phase>\('idle'\)\n",
             f"  const [phase, setPhase] = useState<Phase>('idle')\n{additions}", code)

# 2. Update Header
header_replacement = """
      {/* Header */}
      <div style={header}>
        <span style={headerTitle}>r4mi</span>
        <span style={headerPhase}>
          {isRecordingPaused ? <span style={{color: CLR.red}}>■ Paused Mode</span> : <span style={{color: CLR.green}}>● Passive Mode</span>}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={toggleRecordingPause} style={{...headerBtn, color: isRecordingPaused ? CLR.red : CLR.green, borderColor: isRecordingPaused ? CLR.red : CLR.green}} title="Pause all recording">
             {isRecordingPaused ? 'off' : 'on'}
          </button>
          <button onClick={() => setIsDark(!isDark)} style={headerBtn}>{isDark ? '☀️' : '🌙'}</button>
          <button onClick={() => setPhase('agents')} style={headerBtn}>agents</button>
          <button
            onClick={() => window.parent.postMessage({ type: 'r4mi:close' }, '*')}
            style={headerBtn}
          >x</button>
        </div>
      </div>
      
      {/* Tabs */}
      <div style={{display: 'flex', borderBottom: `1px solid ${CLR.border}`, background: CLR.surface}}>
        <div onClick={() => setTab('chat')} style={{flex: 1, textAlign: 'center', padding: '6px 0', cursor: 'pointer', fontSize: 11, fontWeight: tab === 'chat' ? 700 : 400, color: tab === 'chat' ? CLR.accent : CLR.dim, borderBottom: tab === 'chat' ? `2px solid ${CLR.accent}` : '2px solid transparent'}}>Chat</div>
        <div onClick={() => setTab('activity')} style={{flex: 1, textAlign: 'center', padding: '6px 0', cursor: 'pointer', fontSize: 11, fontWeight: tab === 'activity' ? 700 : 400, color: tab === 'activity' ? CLR.accent : CLR.dim, borderBottom: tab === 'activity' ? `2px solid ${CLR.accent}` : '2px solid transparent'}}>System View</div>
      </div>
"""
code = re.sub(r"      \{/\* Header \*/\}.*?</div>\s*</div>", header_replacement, code, flags=re.DOTALL)

# 3. Handle Messages / Activity mapping
messages_render = """
              {tab === 'chat' ? messages.filter(m => m.type !== 'system' && m.type !== 'notification' && m.type !== 'error' && m.type !== 'agent-step').map((m) => (
                <ChatMessageComponent key={m.id} msg={m} />
              )) : messages.map((m) => (
                <ChatMessageComponent key={m.id} msg={m} />
              ))}
"""
code = re.sub(r"\{messages\.map\(\(m\) => \(\s*<ChatMessageComponent key=\{m\.id\} msg=\{m\} />\s*\)\)}", messages_render, code, flags=re.DOTALL)

# 4. Remove the hardcoded CLR object since it's now dynamic
code = re.sub(r"const CLR = \{\s*bg:[^\}]+\}", "", code)

# Fix double braces issues if present
with open("frontend/src/sidebar/SidebarApp.tsx", "w", encoding="utf-8") as f:
    f.write(code)

print("done")
