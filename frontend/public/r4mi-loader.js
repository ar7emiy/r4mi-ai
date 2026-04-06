/**
 * r4mi-loader.js — drop this script tag on ANY page to get r4mi-ai
 *
 * Usage:
 *   <script src="http://localhost:3000/r4mi-loader.js"
 *           data-api="http://localhost:8000"
 *           data-user-id="permit-tech-001"></script>
 *
 * What it does:
 *   1. Injects capture.js (DOM event observer → POST /api/observe)
 *   2. Creates a floating toggle button (bottom-right corner)
 *   3. Creates an iframe sidebar pointing to /sidebar
 *   4. Listens to SSE for notification badge
 *   5. postMessage bridge between sidebar iframe and host page
 */
; (function () {
  'use strict'

  if (window.__r4mi_loader_active) return
  // Never run inside an iframe (e.g. the /sidebar route)
  if (window !== window.top) return
  window.__r4mi_loader_active = true

  // ── Config ──────────────────────────────────────────────────────────────────
  var script = document.currentScript
  var ORIGIN = script ? new URL(script.src).origin : 'http://localhost:3000'
  var API_BASE = (script && script.getAttribute('data-api')) || 'http://localhost:8000'
  var USER_ID = (script && script.getAttribute('data-user-id')) || 'permit-tech-001'

  // ── 1. Inject capture.js ──────────────────────────────────────────────────
  var captureScript = document.createElement('script')
  captureScript.src = ORIGIN + '/capture.js'
  captureScript.setAttribute('data-api', API_BASE)
  captureScript.setAttribute('data-user-id', USER_ID)
  document.head.appendChild(captureScript)

  // ── 2. Create container ───────────────────────────────────────────────────
  var container = document.createElement('div')
  container.id = 'r4mi-container'
  container.style.cssText =
    'position:fixed;top:0;right:0;bottom:0;width:0;z-index:99999;' +
    'font-family:Inter,system-ui,sans-serif;transition:width 0.3s ease;'
  document.body.appendChild(container)

  // ── 3. Create iframe ──────────────────────────────────────────────────────
  var iframe = document.createElement('iframe')
  iframe.id = 'r4mi-sidebar'
  iframe.src = ORIGIN + '/sidebar'
  iframe.style.cssText =
    'width:100%;height:100%;border:none;background:#0f1117;'
  iframe.allow = 'microphone'  // future: voice input
  container.appendChild(iframe)

  // ── 4. Floating toggle button ──────────────────────────────────────────────
  var SIDEBAR_WIDTH = 400
  var isOpen = false
  var unreadCount = 0

  var btn = document.createElement('button')
  btn.id = 'r4mi-toggle'
  btn.innerHTML = '<img src="' + ORIGIN + '/r4mi-ai-logo.png" style="width:28px;height:28px;object-fit:contain;pointer-events:none;" />'
  btn.style.cssText =
    'position:fixed;bottom:20px;right:20px;z-index:100000;' +
    'width:48px;height:48px;border-radius:50%;border:none;' +
    'background:linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);color:#fff;cursor:pointer;' +
    'display:flex;align-items:center;justify-content:center;' +
    'box-shadow:0 6px 16px rgba(255, 107, 107, 0.4);' +
    'transition:transform 0.2s, right 0.3s ease, background 0.2s;'

  // Guided auto-fill popup
  var popup = document.createElement('div')
  popup.id = 'r4mi-popup'
  popup.style.cssText =
    'position:fixed;bottom:24px;right:78px;z-index:99999;' +
    'background:#1e1b4b;color:#e2e8f0;padding:8px 12px;border-radius:8px;' +
    'font-size:12px;font-weight:600;box-shadow:0 4px 12px rgba(0,0,0,0.3);' +
    'border:1px solid #6366f1;cursor:pointer;' +
    'display:none;align-items:center;opacity:0;transition:opacity 0.3s, transform 0.3s;transform:translateX(10px);'
  popup.innerHTML = '<span style="color:#22c55e;margin-right:6px">✨</span> guided auto-fill available'
  document.body.appendChild(popup)

  var lastDetectedSession = null;
  popup.addEventListener('click', function () {
    popup.style.display = 'none';
    if (!isOpen) toggleSidebar();
    if (iframe.contentWindow && lastDetectedSession) {
      iframe.contentWindow.postMessage({ type: 'r4mi:automation-alert', session_id: lastDetectedSession }, '*')
    }
  })

  // Badge
  var badge = document.createElement('span')
  badge.id = 'r4mi-badge'
  badge.style.cssText =
    'position:absolute;top:-4px;right:-4px;' +
    'background:#dc2626;color:#fff;font-size:10px;font-weight:800;' +
    'min-width:18px;height:18px;border-radius:9px;' +
    'display:none;align-items:center;justify-content:center;' +
    'padding:0 4px;'
  badge.textContent = '0'
  btn.appendChild(badge)

  document.body.appendChild(btn)

  function toggleSidebar() {
    isOpen = !isOpen
    container.style.width = isOpen ? SIDEBAR_WIDTH + 'px' : '0'
    btn.style.right = isOpen ? (SIDEBAR_WIDTH + 20) + 'px' : '20px'

    if (isOpen) {
      // Clear badge
      unreadCount = 0
      badge.style.display = 'none'
      badge.textContent = '0'
      // Notify iframe
      iframe.contentWindow.postMessage(
        {
          type: 'r4mi:opened',
          url: location.href,
          title: document.title,
          activeApplicationId: document.body.dataset.activeApplicationId || null,
        },
        '*'
      )
    }
  }

  btn.addEventListener('click', toggleSidebar)

  // Hover effect
  btn.addEventListener('mouseenter', function () { btn.style.transform = 'scale(1.1)' })
  btn.addEventListener('mouseleave', function () { btn.style.transform = 'scale(1)' })

  // ── 5. SSE listener for badge ─────────────────────────────────────────────
  var BADGE_EVENTS = [
    'OPTIMIZATION_OPPORTUNITY',
    'AGENT_MATCH_FOUND',
    'SPEC_GENERATED',
    'AGENT_PUBLISHED',
  ]

  try {
    var sse = new EventSource(API_BASE + '/api/sse')
    sse.onmessage = function (e) {
      try {
        var data = JSON.parse(e.data)
        if (data.event === 'OPTIMIZATION_OPPORTUNITY') {
          lastDetectedSession = (data.data || data).session_id;
          popup.style.display = 'flex';
          setTimeout(function () { popup.style.opacity = '1'; popup.style.transform = 'translateX(0)'; }, 50);
        }
        if (data.event && BADGE_EVENTS.indexOf(data.event) !== -1 && !isOpen) {
          unreadCount++
          badge.textContent = String(unreadCount)
          badge.style.display = 'flex'
          // Pulse animation
          btn.style.transform = 'scale(1.15)'
          setTimeout(function () { btn.style.transform = 'scale(1)' }, 200)
        }
      } catch (_) { }
    }
  } catch (_) {
    // SSE not available — badge just won't update
  }

  // ── 6. Capture feedback relay ─────────────────────────────────────────────
  window.addEventListener('r4mi:capture-live', function (e) {
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({ type: 'r4mi:capture-live', detail: e.detail }, '*')
    }
  })

  // ── 7. postMessage bridge ─────────────────────────────────────────────────
  window.addEventListener('message', function (e) {
    if (!e.data || !e.data.type) return
    var msg = e.data

    switch (msg.type) {
      case 'r4mi:close':
        if (isOpen) toggleSidebar()
        break

      case 'r4mi:resize':
        if (typeof msg.width === 'number') {
          SIDEBAR_WIDTH = msg.width
          if (isOpen) {
            container.style.width = SIDEBAR_WIDTH + 'px'
            btn.style.right = (SIDEBAR_WIDTH + 20) + 'px'
          }
        }
        break

      case 'r4mi:set-session':
        // Activate/deactivate capture.js by setting data-session-id on <body>
        if (msg.sessionId) {
          document.body.setAttribute('data-session-id', msg.sessionId)
          if (msg.permitType) {
            document.body.setAttribute('data-permit-type', msg.permitType)
          }
        } else {
          document.body.removeAttribute('data-session-id')
        }
        break

      case 'r4mi:open':
        if (!isOpen) toggleSidebar()
        break

      case 'r4mi:run-agent':
        if (msg.specId) {
          var appId = msg.applicationId || document.body.dataset.activeApplicationId || ''
          fetch(API_BASE + '/api/agents/' + msg.specId + '/run?application_id=' + encodeURIComponent(appId), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          }).catch(function () { })
        }
        break

      case 'r4mi:navigate-tab':
        // HITL replay: sidebar requests host page to switch to a specific tab
        window.dispatchEvent(new CustomEvent('r4mi:navigate-tab', { detail: { tab: msg.tab } }))
        break


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


      case 'r4mi:show-me':
        // Lazy-inject html2canvas for screenshot capture (only when first needed)
        if (!window.__r4mi_html2canvas_loaded) {
          window.__r4mi_html2canvas_loaded = true
          var h2c = document.createElement('script')
          h2c.src = 'https://html2canvas.hertzen.com/dist/html2canvas.min.js'
          document.head.appendChild(h2c)
        }
        // Sidebar requests host page enter teach-me mode for source capture
        document.body.dataset.demoMode = 'true'
        document.body.dataset.teachMode = 'true'
        // Dispatch custom event so React app can respond
        window.dispatchEvent(new CustomEvent('r4mi:show-me', { detail: msg }))
        // Listen for source-selected from host page and relay back to sidebar
        window.addEventListener('r4mi:source-selected', function onSourceSelected(ev) {
          window.removeEventListener('r4mi:source-selected', onSourceSelected)
          delete document.body.dataset.demoMode
          delete document.body.dataset.teachMode
          var detail = ev.detail || {}
          iframe.contentWindow.postMessage(
            { type: 'r4mi:source-confirmed', section: detail.section, content: detail.content },
            '*'
          )
        }, { once: true })
        break
    }
  })

})()
