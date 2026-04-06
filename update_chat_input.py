import re

with open("frontend/src/sidebar/components/ChatInput.tsx", "r", encoding="utf-8") as f:
    code = f.read()

return_block = """
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
"""

code = re.sub(r"  return \(\s*<div style=\{container\}>.*?</div>\s*\)", return_block, code, flags=re.DOTALL)

with open("frontend/src/sidebar/components/ChatInput.tsx", "w", encoding="utf-8") as f:
    f.write(code)

print("done")
