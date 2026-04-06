import re

with open("frontend/public/r4mi-loader.js", "r", encoding="utf-8") as f:
    code = f.read()

# Replace logo SRC
code = code.replace("r4mi-logo.png", "r4mi-ai-logo.png")

# Add r4mi:demo-step handler and typing logic
r4mi_handler = """
      case 'r4mi:demo-step':
        if (msg.step) {
          var step = msg.step;
          var field = (step.field || '').toLowerCase();
          var input = null;
          if (field.includes('zone')) input = document.querySelector('[data-testid="field-zone"]');
          else if (field.includes('note') || field.includes('decision')) input = document.querySelector('[data-testid="field-notes"]');
          else if (field.includes('height') || field.includes('max')) input = document.querySelector('[data-testid="field-max-height"]');

          if (!input) {
            window.dispatchEvent(new CustomEvent('r4mi:demo-step', { detail: step }));
            return;
          }

          var label = document.createElement('span');
          label.innerHTML = step.source_tag || 'from agent';
          label.style.cssText = 'position:absolute; background:rgb(26,29,39); border:1px solid rgb(99,102,241); color:rgb(148,163,184); font-size:10px; font-family:Inter,system-ui,sans-serif; padding:1px 6px; border-radius:2px; z-index:99999; transform:translateY(-100%); margin-top:-2px;';
          
          var isReadOnly = input.disabled || input.readOnly || input.nodeName === 'DIV' || input.nodeName === 'SPAN';

          if (isReadOnly) {
            // Virtual Input Overlay
            var overlay = document.createElement('div');
            var rect = input.getBoundingClientRect();
            overlay.style.cssText = 'position:absolute; z-index:99998; border:2px dashed #f59e0b; background:rgba(245,158,11,0.1); color:#f59e0b; font-size:12px; font-family:monospace; padding:4px 8px; border-radius:4px; box-sizing:border-box; pointer-events:none; display:flex; align-items:center;';
            overlay.style.left = (rect.left + window.scrollX) + 'px';
            overlay.style.top = (rect.top + window.scrollY) + 'px';
            overlay.style.width = rect.width + 'px';
            overlay.style.height = rect.height + 'px';
            overlay.innerText = step.value;
            
            label.style.left = overlay.style.left;
            label.style.top = overlay.style.top;
            
            document.body.appendChild(overlay);
            document.body.appendChild(label);
          } else {
            // Actual Typing Animation
            input.parentElement.position = 'relative'; // ensure tag can overlay relatively if we append it nearby
            var rect = input.getBoundingClientRect();
            label.style.left = (rect.left + window.scrollX) + 'px';
            label.style.top = (rect.top + window.scrollY) + 'px';
            document.body.appendChild(label);
            
            var val = step.value;
            var idx = 0;
            var typeInterval = setInterval(function() {
              if (idx <= val.length) {
                input.value = val.slice(0, idx);
                var evt = new Event('input', { bubbles: true });
                input.dispatchEvent(evt);
                idx++;
              } else {
                clearInterval(typeInterval);
              }
            }, 60);
          }
        }
        break;
"""

code = code.replace(
    """      case 'r4mi:replay-step':
        // HITL replay: sidebar sends one step at a time to fill on the host page
        if (msg.step) {
          window.dispatchEvent(new CustomEvent('r4mi:demo-step', { detail: msg.step }))
        }
        break""",
    r4mi_handler
)

with open("frontend/public/r4mi-loader.js", "w", encoding="utf-8") as f:
    f.write(code)

print("done")
