import re

with open("frontend/src/sidebar/SidebarApp.tsx", "r", encoding="utf-8") as f:
    code = f.read()

# Replace Imports
code = code.replace(
    "import { HITLReplay } from './components/HITLReplay'",
    "import { HITLReplay } from './components/HITLReplay'\nimport { ChatInput } from './components/ChatInput'\nimport { ChatMessage as ChatMessageComponent } from './components/ChatMessage'\nimport { useChatMessages } from './hooks/useChatMessages'"
)

# Replace logs state
code = code.replace(
    "const [logs, setLogs] = useState<LogEntry[]>([mkLog('observing. work normally.')])",
    "const { messages, addMessage, updateMessage } = useChatMessages()"
)

# Replace mkLog function wrapper logic
code = re.sub(
    r"const log = useCallback\(\(text: string, level: LogEntry\['level'\] = 'info'\) => \{.*?\}, \[\]\)",
    "const log = useCallback((text: string, level: LogEntry['level'] = 'info') => {\n    const type = level === 'success' ? 'system' : level === 'error' ? 'error' : 'system'\n    addMessage(type, text)\n  }, [addMessage])",
    code, flags=re.DOTALL
)

# Replace logs effect dep
code = code.replace("}, [logs])", "}, [messages])")

# Add r4mi:automation-alert handler
code = code.replace(
    "if (e.data.type === 'r4mi:opened') {",
    """if (e.data.type === 'r4mi:automation-alert') {
        const sessionId = e.data.session_id
        addMessage('notification', 'Guided auto-fill is available.')
        addMessage('spec', 'Utility: Data entry automation\\nGoals: Save time\\nInput: Page context\\nOutput: Filled forms', {})
        setTimeout(() => {
          addMessage('system', 'Next: show each step? Do you have questions?')
        }, 500)
      }
      if (e.data.type === 'r4mi:opened') {"""
)

# Replace CLR
code = re.sub(r"const CLR = \{[^}]+\}", """const CLR = {
  bg: '#09090b',
  surface: '#18181b',
  border: '#27272a',
  text: '#f4f4f5',
  dim: '#a1a1aa',
  accent: '#FF7E67',
  green: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
}""", code)

# We want to replace all logs.map with messages.map
code = re.sub(r"\{logs\.map\(\(l\) => \(\s*<LogLine key=\{l\.id\} entry=\{l\} />\s*\)\)}", "{messages.map((m) => (<ChatMessageComponent key={m.id} msg={m} />))}", code, flags=re.DOTALL)

# Add ChatInput in the idle footer instead of the teach me button
code = re.sub(r"\{/\* Footer — teach me \+ command input \*/\}.*?\{phase === 'idle' && \(\s*<div style=\{footer\}>\s*<button onClick=\{startRecording\} style=\{btnPrimary\}>\s*▶ teach me\s*</button>\s*</div>\s*\)\}", """{/* Footer — teach me + command input */}
      <ChatInput addMessage={addMessage} isRecording={recording.active} setIsRecording={() => phase === 'recording' ? stopRecording() : startRecording()} onToggleAgentverse={() => setPhase('agents')} />""", code, flags=re.DOTALL)

with open("frontend/src/sidebar/SidebarApp.tsx", "w", encoding="utf-8") as f:
    f.write(code)

print("done")
