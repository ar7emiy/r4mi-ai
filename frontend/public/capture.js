/**
 * r4mi-ai capture.js — enterprise drop-in observer
 *
 * Include via:
 *   <script src="/capture.js" data-api="http://localhost:8000" data-user-id="permit-tech-001"></script>
 *
 * The host application cooperates by adding two data attributes to <body>:
 *   data-session-id="<unique-session-id>"   (changes on each new work item)
 *   data-permit-type="<permit-type-slug>"   (e.g. "fence_variance")
 *
 * When active, sets window.__r4mi_capture_active = true so the React
 * application can skip its own manual observe POSTs.
 */
;(function () {
  'use strict'

  // ── Config ──────────────────────────────────────────────────────────────────
  const script = document.currentScript
  const API_BASE = (script && script.getAttribute('data-api')) || 'http://localhost:8000'
  const CONFIGURED_USER_ID = (script && script.getAttribute('data-user-id')) || 'permit-tech-001'

  // ── Activation guard ────────────────────────────────────────────────────────
  // Only activate when the host has explicitly prepared a session by setting
  // data-session-id on <body>. Without it, capture.js stays passive so the
  // React test harness (E2E suite) can post synthetic events uninterrupted.
  if (window.__r4mi_capture_active) return
  if (!document.body.getAttribute('data-session-id')) {
    // Poll for session-id to appear (host app sets it when a work item is opened)
    var _waitInterval = setInterval(function () {
      if (document.body.getAttribute('data-session-id')) {
        clearInterval(_waitInterval)
        window.__r4mi_capture_active = true
        // Re-run initialisation now that a session is present
      }
    }, 500)
    return
  }
  window.__r4mi_capture_active = true

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function getSessionMeta() {
    const body = document.body
    return {
      session_id: body.getAttribute('data-session-id') || 'session-' + Date.now(),
      permit_type: body.getAttribute('data-permit-type') || null,
    }
  }

  function getScreenName() {
    // Prefer explicit data-screen attribute on main content area
    const main = document.querySelector('[data-screen], [role="main"], main')
    if (main && main.getAttribute('data-screen')) return main.getAttribute('data-screen')
    // Derive from document title (e.g. "GIS Lookup | Permit Portal" → "GIS_LOOKUP")
    const title = document.title.split('|')[0].trim().toUpperCase().replace(/\s+/g, '_')
    return title || 'UNKNOWN_SCREEN'
  }

  function getElementContext(el) {
    if (!el) return null
    const label =
      el.getAttribute('aria-label') ||
      el.getAttribute('placeholder') ||
      el.getAttribute('title') ||
      (el.labels && el.labels[0] ? el.labels[0].textContent.trim() : '') ||
      el.textContent.trim().slice(0, 60) ||
      ''
    const role = el.getAttribute('role') || el.tagName.toLowerCase()
    const landmark = (function () {
      let node = el.parentElement
      while (node && node !== document.body) {
        const r = node.getAttribute('role')
        if (r && ['main', 'navigation', 'complementary', 'form', 'region'].includes(r))
          return r
        if (['main', 'nav', 'aside', 'header', 'footer', 'section', 'form'].includes(node.tagName.toLowerCase()))
          return node.tagName.toLowerCase()
        node = node.parentElement
      }
      return 'body'
    })()
    const rect = el.getBoundingClientRect()
    return {
      label: label,
      role: role,
      text: el.value || el.textContent.trim().slice(0, 120),
      position: { x: Math.round(rect.left), y: Math.round(rect.top) },
      landmark: landmark,
    }
  }

  function getCssSelector(el) {
    if (!el) return ''
    if (el.id) return '#' + el.id
    if (el.getAttribute('data-testid')) return '[data-testid="' + el.getAttribute('data-testid') + '"]'
    if (el.name) return el.tagName.toLowerCase() + '[name="' + el.name + '"]'
    // Build a short path from the element up
    const parts = []
    let node = el
    for (let i = 0; i < 4 && node && node !== document.body; i++) {
      let seg = node.tagName.toLowerCase()
      if (node.className && typeof node.className === 'string') {
        const cls = node.className.trim().split(/\s+/).slice(0, 2).join('.')
        if (cls) seg += '.' + cls
      }
      parts.unshift(seg)
      node = node.parentElement
    }
    return parts.join(' > ')
  }

  // ── Teach-me mode: screenshot capture ────────────────────────────────────────
  async function captureScreenshot() {
    if (!isTeachMode()) return null
    if (typeof window.html2canvas !== 'function') return null
    try {
      var canvas = await Promise.race([
        window.html2canvas(document.documentElement, { scale: 0.5, useCORS: true, logging: false }),
        new Promise(function (_, reject) { setTimeout(function () { reject(new Error('timeout')) }, 500) }),
      ])
      // Strip data: prefix — backend expects raw base64
      return canvas.toDataURL('image/jpeg', 0.6).split(',')[1] || null
    } catch (_) {
      return null
    }
  }

  // ── POST to backend ──────────────────────────────────────────────────────────
  async function postEvent(eventData) {
    try {
      await fetch(API_BASE + '/api/observe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData),
        keepalive: true,
      })
    } catch (_) {
      // Non-fatal — observer failures must not interrupt the worker
    }
  }

  function buildBase(eventType, el) {
    const meta = getSessionMeta()
    const teachMode = isTeachMode()
    // Consume pending narration and clear it for the next event
    const narration = _pendingNarration
    if (teachMode) _pendingNarration = null
    return {
      session_id: meta.session_id,
      user_id: CONFIGURED_USER_ID,
      timestamp: new Date().toISOString(),
      event_type: eventType,
      screen_name: getScreenName(),
      element_selector: getCssSelector(el),
      element_value: null,
      permit_type: meta.permit_type,
      capture_mode: teachMode ? 'teach' : 'obs',
      element_context: getElementContext(el),
      step_description: teachMode ? narration : null,
    }
  }

  // ── Teach-me mode: voice narration ───────────────────────────────────────────
  var _pendingNarration = null
  var _recognition = null

  function isTeachMode() {
    return document.body.getAttribute('data-teach-mode') === 'true'
  }

  function startVoice() {
    if (_recognition) return
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    _recognition = new SR()
    _recognition.continuous = true
    _recognition.interimResults = false
    _recognition.lang = 'en-US'
    _recognition.onresult = function (e) {
      var last = e.results[e.results.length - 1]
      if (last && last.isFinal) {
        _pendingNarration = last[0].transcript.trim()
      }
    }
    _recognition.onerror = function () {}
    _recognition.onend = function () {
      // Restart if teach mode still active (recognition stops on long pauses)
      if (isTeachMode()) _recognition.start()
    }
    try { _recognition.start() } catch (_) {}
  }

  function stopVoice() {
    if (!_recognition) return
    try { _recognition.stop() } catch (_) {}
    _recognition = null
    _pendingNarration = null
  }

  // Watch for data-teach-mode attribute appearing / disappearing on body
  var _teachObserver = new MutationObserver(function () {
    if (isTeachMode()) {
      startVoice()
    } else {
      stopVoice()
    }
  })
  _teachObserver.observe(document.body, { attributes: true, attributeFilter: ['data-teach-mode'] })

  // Start immediately if already in teach mode when capture.js loads
  if (isTeachMode()) startVoice()

  // ── Debounce helper ──────────────────────────────────────────────────────────
  function debounce(fn, ms) {
    let t
    return function (...args) {
      clearTimeout(t)
      t = setTimeout(() => fn.apply(this, args), ms)
    }
  }

  // ── Screen change detection ──────────────────────────────────────────────────
  let _lastScreen = getScreenName()

  function checkScreenChange() {
    const screen = getScreenName()
    if (screen !== _lastScreen) {
      _lastScreen = screen
      const evt = buildBase('screen_switch', document.activeElement)
      evt.screen_name = screen
      if (isTeachMode()) {
        captureScreenshot().then(function (b64) {
          evt.screenshot_b64 = b64
          postEvent(evt)
        })
      } else {
        postEvent(evt)
      }
    }
  }

  // Observe DOM mutations that might indicate a screen change
  const _screenObserver = new MutationObserver(debounce(checkScreenChange, 200))
  _screenObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-screen'] })

  // Also hook navigation events
  window.addEventListener('popstate', checkScreenChange)
  window.addEventListener('hashchange', checkScreenChange)

  // ── Click events ─────────────────────────────────────────────────────────────
  document.addEventListener('click', function (e) {
    const el = e.target
    if (!el || el === document.body) return
    // Skip trivial clicks on containers
    const tag = el.tagName.toLowerCase()
    if (['div', 'span', 'main', 'section', 'article'].includes(tag) && !el.getAttribute('role')) return

    const evt = buildBase('click', el)
    evt.element_value = el.value || el.textContent.trim().slice(0, 100) || null
    if (isTeachMode()) {
      captureScreenshot().then(function (b64) {
        evt.screenshot_b64 = b64
        postEvent(evt)
      })
    } else {
      postEvent(evt)
    }
  }, { capture: true, passive: true })

  // ── Input / change events ────────────────────────────────────────────────────
  const _inputDebounced = debounce(function (e) {
    const el = e.target
    if (!el) return
    const evt = buildBase('input', el)
    evt.element_value = el.value || null
    evt.is_input_variable = true  // user-entered values are always per-case
    postEvent(evt)
  }, 400)

  document.addEventListener('input', _inputDebounced, { capture: true, passive: true })
  document.addEventListener('change', _inputDebounced, { capture: true, passive: true })

  // ── Form submit ───────────────────────────────────────────────────────────────
  document.addEventListener('submit', function (e) {
    const el = e.target
    const evt = buildBase('submit', el)
    postEvent(evt)
  }, { capture: true, passive: true })

  // ── Copy events ───────────────────────────────────────────────────────────────
  document.addEventListener('copy', function (e) {
    const selection = window.getSelection()
    const evt = buildBase('copy', e.target)
    evt.element_value = selection ? selection.toString().slice(0, 200) : null
    postEvent(evt)
  }, { capture: true, passive: true })

  // ── Initial navigate event ────────────────────────────────────────────────────
  ;(function sendInitialNavigate() {
    const evt = buildBase('navigate', document.body)
    evt.element_selector = 'document'
    postEvent(evt)
  })()

})()
