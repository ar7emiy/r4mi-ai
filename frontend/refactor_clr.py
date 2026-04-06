import re

with open("src/sidebar/SidebarApp.tsx", "r", encoding="utf-8") as f:
    code = f.read()

replacement = """
  useEffect(() => {
    const clrs = isDark ? {
      '--clr-bg': '#09090b',
      '--clr-surface': '#18181b',
      '--clr-border': '#27272a',
      '--clr-text': '#f4f4f5',
      '--clr-dim': '#a1a1aa',
      '--clr-accent': '#FF7E67',
      '--clr-green': '#10b981',
      '--clr-amber': '#f59e0b',
      '--clr-red': '#ef4444',
    } : {
      '--clr-bg': '#f8fafc',
      '--clr-surface': '#ffffff',
      '--clr-border': '#e2e8f0',
      '--clr-text': '#0f172a',
      '--clr-dim': '#64748b',
      '--clr-accent': '#FF7E67',
      '--clr-green': '#059669',
      '--clr-amber': '#d97706',
      '--clr-red': '#dc2626',
    };
    for (const [k, v] of Object.entries(clrs)) {
      document.body.style.setProperty(k, v);
    }
  }, [isDark]);
"""

code = re.sub(r"  const CLR = isDark \? \{.*?} : \{.*?}\n", replacement, code, flags=re.DOTALL)

code = re.sub(r"// ── API ──.*", r"export const CLR = {bg:'var(--clr-bg)',surface:'var(--clr-surface)',border:'var(--clr-border)',text:'var(--clr-text)',dim:'var(--clr-dim)',accent: 'var(--clr-accent)',green: 'var(--clr-green)',amber: 'var(--clr-amber)',red: 'var(--clr-red)'};\n// ── API ──", code)

code = re.sub(r"function mkLog.*?\n\}\n", "", code, flags=re.DOTALL)
code = re.sub(r"function LogLine.*?\n\}\n", "", code, flags=re.DOTALL)
code = re.sub(r"const footer: React\.CSSProperties = \{.*?\n\}\n", "", code, flags=re.DOTALL)

code = code.replace("const { messages, addMessage, updateMessage } = useChatMessages()", "const { messages, addMessage } = useChatMessages()")
code = code.replace("const sessionId = e.data.session_id", "")

with open("src/sidebar/SidebarApp.tsx", "w", encoding="utf-8") as f:
    f.write(code)

print("done")
