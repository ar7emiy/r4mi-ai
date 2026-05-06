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
; (function () {
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

  // ── Accessible name resolution ────────────────────────────────────────────
  function getAccessibleName(el) {
    if (!el) return ''
    // Priority order matches WAI-ARIA accessible-name computation
    const aria = el.getAttribute('aria-label')
    if (aria) return aria.trim()
    const labelledBy = el.getAttribute('aria-labelledby')
    if (labelledBy) {
      const ref = document.getElementById(labelledBy)
      if (ref) return ref.textContent.trim().slice(0, 120)
    }
    if (el.labels && el.labels[0]) return el.labels[0].textContent.trim().slice(0, 120)
    const placeholder = el.getAttribute('placeholder')
    if (placeholder) return placeholder.trim()
    const title = el.getAttribute('title')
    if (title) return title.trim()
    const alt = el.getAttribute('alt')
    if (alt) return alt.trim()
    // For buttons/links/headings, inner text is the accessible name
    const innerText = (el.textContent || '').trim().slice(0, 120)
    if (innerText) return innerText
    return ''
  }

  function getRole(el) {
    const explicit = el.getAttribute('role')
    if (explicit) return explicit.toLowerCase()
    const tag = el.tagName.toLowerCase()
    // Map HTML tags to ARIA roles where unambiguous
    const map = {
      a: 'link', button: 'button', input: 'textbox', textarea: 'textbox',
      select: 'combobox', form: 'form', nav: 'navigation', main: 'main',
      aside: 'complementary', header: 'banner', footer: 'contentinfo',
      section: 'region', h1: 'heading', h2: 'heading', h3: 'heading',
      h4: 'heading', h5: 'heading', h6: 'heading', img: 'image', li: 'listitem',
      ul: 'list', ol: 'list', table: 'table', tr: 'row', td: 'cell', th: 'columnheader',
    }
    if (tag === 'input') {
      const type = (el.getAttribute('type') || 'text').toLowerCase()
      if (type === 'checkbox') return 'checkbox'
      if (type === 'radio') return 'radio'
      if (type === 'submit' || type === 'button') return 'button'
      return 'textbox'
    }
    return map[tag] || tag
  }

  function getLandmark(el) {
    let node = el.parentElement
    while (node && node !== document.body) {
      const r = (node.getAttribute('role') || '').toLowerCase()
      if (['main', 'navigation', 'complementary', 'form', 'region', 'banner', 'contentinfo'].includes(r))
        return r
      const tag = node.tagName.toLowerCase()
      if (['main', 'nav', 'aside', 'header', 'footer', 'section', 'form'].includes(tag))
        return tag
      node = node.parentElement
    }
    return 'body'
  }

  function getSurroundingText(el) {
    const parts = []
    // Parent's text excluding the element's own text
    if (el.parentElement) {
      const parentText = (el.parentElement.textContent || '').trim()
      const ownText = (el.textContent || '').trim()
      const surrounding = parentText.replace(ownText, '').trim().slice(0, 80)
      if (surrounding) parts.push(surrounding)
    }
    // Previous sibling label-like text
    const prev = el.previousElementSibling
    if (prev) {
      const prevText = (prev.textContent || '').trim().slice(0, 60)
      if (prevText) parts.push(prevText)
    }
    return parts.join(' | ').slice(0, 160)
  }

  function getPositionSignature(el, landmark, role) {
    // Find the landmark ancestor element to scope ordinal lookup
    let scope = document.body
    let node = el.parentElement
    while (node && node !== document.body) {
      const r = (node.getAttribute('role') || '').toLowerCase()
      const tag = node.tagName.toLowerCase()
      if (
        ['main', 'navigation', 'complementary', 'form', 'region', 'banner', 'contentinfo'].includes(r) ||
        ['main', 'nav', 'aside', 'header', 'footer', 'section', 'form'].includes(tag)
      ) {
        scope = node
        break
      }
      node = node.parentElement
    }
    // Find ordinal among same-role siblings within the landmark scope
    const candidates = []
    const walk = (n) => {
      if (!n) return
      if (n.nodeType === 1 && n !== scope) {
        if (getRole(n) === role) candidates.push(n)
      }
      for (let i = 0; i < n.childNodes.length; i++) walk(n.childNodes[i])
    }
    walk(scope)
    const ordinal = candidates.indexOf(el)
    return `${landmark}:${role}:${ordinal >= 0 ? ordinal : 0}`
  }

  function buildFingerprint(el) {
    if (!el) return null
    const role = getRole(el)
    const accessible_name = getAccessibleName(el)
    const landmark = getLandmark(el)
    const surrounding_text = getSurroundingText(el)
    const position_signature = getPositionSignature(el, landmark, role)
    return {
      role: role,
      accessible_name: accessible_name,
      landmark: landmark,
      surrounding_text: surrounding_text,
      position_signature: position_signature,
      url_pattern: location.pathname,
    }
  }

  // Legacy element_context — kept for backwards compatibility during
  // migration. Once SpecBuilder + NarrowAgent + r4mi-loader all consume
  // element_fingerprint, this function and its uses can be deleted.
  function getElementContext(el) {
    if (!el) return null
    const fp = buildFingerprint(el)
    const rect = el.getBoundingClientRect()
    return {
      label: fp.accessible_name,
      role: fp.role,
      text: el.value || (el.textContent || '').trim().slice(0, 120),
      position: { x: Math.round(rect.left), y: Math.round(rect.top) },
      landmark: fp.landmark,
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

  // ── Capture feedback dispatcher ──────────────────────────────────────────────
  function dispatchCaptureFeedback(detail) {
    try {
      window.dispatchEvent(new CustomEvent('r4mi:capture-live', { detail: detail }))
    } catch (_) { }
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
  // _origFetch is captured BEFORE we wrap window.fetch, so all r4mi
  // outgoing calls bypass the network-capture wrapper (no recursion).
  var _origFetch = window.fetch.bind(window)

  async function postEvent(eventData) {
    if (localStorage.getItem('r4mi_pause_recording') === 'true') return;
    try {
      await _origFetch(API_BASE + '/api/observe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData),
        keepalive: true,
      })
    } catch (_) {
      // Non-fatal — observer failures must not interrupt the worker
    }
  }

  async function postNetworkCall(call) {
    if (localStorage.getItem('r4mi_pause_recording') === 'true') return;
    try {
      await _origFetch(API_BASE + '/api/observe/network', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(call),
        keepalive: true,
      })
    } catch (_) {
      // Non-fatal
    }
  }

  // ── Fetch + XHR interception ─────────────────────────────────────────────────
  // We record every host-app fetch/XHR call (URL, method, request body,
  // response body) so SpecBuilder can see the actual data sources used and
  // NarrowAgent can replay the same fetches at run time. r4mi's own calls
  // (/api/observe, /api/sse, /api/logs, /api/agents, etc.) are skipped to
  // avoid recursion and noise.
  var SKIP_PREFIXES = ['/api/observe', '/api/sse', '/api/logs', '/api/agents', '/api/session', '/api/chat', '/api/evidence']

  function urlPath(u) {
    try {
      if (u.startsWith('http://') || u.startsWith('https://')) {
        return new URL(u).pathname
      }
      return u.split('?')[0]
    } catch (_) { return u }
  }

  function shouldSkipUrl(u) {
    if (!u) return true
    if (typeof u !== 'string') {
      try { u = String(u) } catch (_) { return true }
    }
    if (u.startsWith(API_BASE)) return true
    var p = urlPath(u)
    return SKIP_PREFIXES.some(function (prefix) { return p.startsWith(prefix) })
  }

  function safeStringifyBody(body) {
    if (body == null) return null
    if (typeof body === 'string') return body.slice(0, 8192)
    try {
      if (body instanceof FormData) {
        var pairs = []
        body.forEach(function (v, k) {
          pairs.push(k + '=' + (typeof v === 'string' ? v : '[file]'))
        })
        return pairs.join('&').slice(0, 8192)
      }
      if (body instanceof URLSearchParams) return body.toString().slice(0, 8192)
      if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) return '[binary]'
      return JSON.stringify(body).slice(0, 8192)
    } catch (_) {
      return '[unserializable]'
    }
  }

  async function safeReadResponseText(resp) {
    try {
      var clone = resp.clone()
      var text = await clone.text()
      return text.slice(0, 8192)
    } catch (_) { return null }
  }

  function headersToObject(headers) {
    var out = {}
    if (!headers) return out
    if (typeof headers.forEach === 'function') {
      headers.forEach(function (v, k) { out[k.toLowerCase()] = v })
    } else if (Array.isArray(headers)) {
      headers.forEach(function (pair) { out[String(pair[0]).toLowerCase()] = pair[1] })
    } else if (typeof headers === 'object') {
      Object.keys(headers).forEach(function (k) { out[k.toLowerCase()] = headers[k] })
    }
    return out
  }

  // Wrap window.fetch
  window.fetch = async function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || ''
    var method = (init && init.method) || (input && input.method) || 'GET'
    var requestBody = init && init.body != null ? safeStringifyBody(init.body) : null

    if (shouldSkipUrl(url)) {
      return _origFetch(input, init)
    }

    var t0 = Date.now()
    var meta = getSessionMeta()
    var screenAtRequest = getScreenName()
    try {
      var resp = await _origFetch(input, init)
      var responseBody = await safeReadResponseText(resp)
      postNetworkCall({
        session_id: meta.session_id,
        method: method.toUpperCase(),
        url: url,
        request_body: requestBody,
        response_status: resp.status,
        response_body: responseBody,
        response_headers: headersToObject(resp.headers),
        timestamp: new Date().toISOString(),
        screen_at_request: screenAtRequest,
        duration_ms: Date.now() - t0,
      })
      return resp
    } catch (err) {
      postNetworkCall({
        session_id: meta.session_id,
        method: method.toUpperCase(),
        url: url,
        request_body: requestBody,
        response_status: 0,
        response_body: 'ERROR: ' + (err && err.message ? err.message : String(err)),
        response_headers: null,
        timestamp: new Date().toISOString(),
        screen_at_request: screenAtRequest,
        duration_ms: Date.now() - t0,
      })
      throw err
    }
  }

  // Wrap XMLHttpRequest
  var _XHRopen = XMLHttpRequest.prototype.open
  var _XHRsend = XMLHttpRequest.prototype.send
  var _XHRsetHeader = XMLHttpRequest.prototype.setRequestHeader

  XMLHttpRequest.prototype.open = function (method, url) {
    this.__r4mi_method = (method || 'GET').toUpperCase()
    this.__r4mi_url = url || ''
    this.__r4mi_req_headers = {}
    return _XHRopen.apply(this, arguments)
  }
  XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
    if (this.__r4mi_req_headers) this.__r4mi_req_headers[String(name).toLowerCase()] = value
    return _XHRsetHeader.apply(this, arguments)
  }
  XMLHttpRequest.prototype.send = function (body) {
    var xhr = this
    var url = xhr.__r4mi_url
    if (!shouldSkipUrl(url)) {
      var meta = getSessionMeta()
      var t0 = Date.now()
      var screenAtRequest = getScreenName()
      var requestBody = body != null ? safeStringifyBody(body) : null
      xhr.addEventListener('loadend', function () {
        var responseBody = null
        try {
          responseBody = typeof xhr.responseText === 'string' ? xhr.responseText.slice(0, 8192) : null
        } catch (_) { /* responseText not accessible for some types */ }
        postNetworkCall({
          session_id: meta.session_id,
          method: xhr.__r4mi_method,
          url: url,
          request_body: requestBody,
          response_status: xhr.status,
          response_body: responseBody,
          response_headers: null,
          timestamp: new Date().toISOString(),
          screen_at_request: screenAtRequest,
          duration_ms: Date.now() - t0,
        })
      })
    }
    return _XHRsend.apply(this, arguments)
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
      element_fingerprint: buildFingerprint(el),
      element_context: getElementContext(el),  // legacy — to be removed
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
        dispatchCaptureFeedback({ type: 'narration', text: _pendingNarration })
      }
    }
    _recognition.onerror = function () { }
    _recognition.onend = function () {
      // Restart if teach mode still active (recognition stops on long pauses)
      if (isTeachMode()) _recognition.start()
    }
    try { _recognition.start() } catch (_) { }
  }

  function stopVoice() {
    if (!_recognition) return
    try { _recognition.stop() } catch (_) { }
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
          if (b64) {
            dispatchCaptureFeedback({ type: 'screenshot', dataUrl: 'data:image/jpeg;base64,' + b64 })
          }
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
      var ctx = getElementContext(el)
      dispatchCaptureFeedback({
        type: 'action',
        label: ctx ? ctx.label || el.tagName.toLowerCase() : el.tagName.toLowerCase(),
        screen: getScreenName(),
        role: ctx ? ctx.role : el.tagName.toLowerCase(),
      })
      captureScreenshot().then(function (b64) {
        evt.screenshot_b64 = b64
        if (b64) {
          dispatchCaptureFeedback({ type: 'screenshot', dataUrl: 'data:image/jpeg;base64,' + b64 })
        }
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

  // ── Knowledge-consumption signals ────────────────────────────────────────────
  // These site-agnostic interaction signals replace the previous hardcoded
  // POLICY_REFERENCE / CODE_ENFORCEMENT screen-name allowlist. capture.js
  // fires generic "dwell", "selection", and "scroll" events when the worker
  // appears to be consuming knowledge. The backend's knowledge_detector
  // decides whether to invoke Vision based on these signals.
  function postKnowledgeEvent(eventType, el, extras) {
    const evt = buildBase(eventType, el || document.activeElement || document.body)
    Object.assign(evt, extras || {})
    if (isTeachMode()) {
      captureScreenshot().then(function (b64) {
        evt.screenshot_b64 = b64
        if (b64) {
          dispatchCaptureFeedback({ type: 'screenshot', dataUrl: 'data:image/jpeg;base64,' + b64 })
        }
        postEvent(evt)
      })
    } else {
      postEvent(evt)
    }
  }

  // Long mouseover / dwell — fires when the user hovers a text-rich element
  // for >2s, indicating they're reading rather than just moving past.
  var _hoverEl = null
  var _hoverTimer = null
  document.addEventListener('mouseover', function (e) {
    var el = e.target
    if (!el || el === _hoverEl) return
    if (_hoverTimer) clearTimeout(_hoverTimer)
    _hoverEl = el
    var textLen = (el.textContent || '').trim().length
    // Only consider text-rich targets — skip buttons, inputs, layout containers
    if (textLen < 80) return
    var role = getRole(el)
    if (['button', 'textbox', 'combobox', 'checkbox', 'radio'].includes(role)) return
    _hoverTimer = setTimeout(function () {
      postKnowledgeEvent('dwell', el, {
        element_value: (el.textContent || '').trim().slice(0, 400),
      })
    }, 2000)
  }, { capture: true, passive: true })
  document.addEventListener('mouseout', function () {
    if (_hoverTimer) clearTimeout(_hoverTimer)
    _hoverTimer = null
    _hoverEl = null
  }, { capture: true, passive: true })

  // Text selection — fires when the user selects text (debounced).
  var _selectionTimer = null
  document.addEventListener('selectionchange', function () {
    if (_selectionTimer) clearTimeout(_selectionTimer)
    _selectionTimer = setTimeout(function () {
      var sel = window.getSelection()
      if (!sel) return
      var text = sel.toString().trim()
      if (text.length < 30) return  // skip stray clicks
      var anchor = sel.anchorNode && sel.anchorNode.nodeType === 1
        ? sel.anchorNode
        : sel.anchorNode && sel.anchorNode.parentElement
      postKnowledgeEvent('selection', anchor, { element_value: text.slice(0, 400) })
    }, 600)
  }, { capture: true, passive: true })

  // Scroll-stall — fires when the user has scrolled significantly then paused
  // (>3s no scroll motion), indicating they're reading the visible region.
  var _lastScrollY = window.scrollY
  var _scrollTimer = null
  var _scrolled = false
  window.addEventListener('scroll', function () {
    var dy = Math.abs(window.scrollY - _lastScrollY)
    if (dy > 100) _scrolled = true
    _lastScrollY = window.scrollY
    if (_scrollTimer) clearTimeout(_scrollTimer)
    _scrollTimer = setTimeout(function () {
      if (!_scrolled) return
      _scrolled = false
      // Only fire if there's substantial visible text
      var bodyText = (document.body.textContent || '').trim()
      if (bodyText.length < 500) return
      postKnowledgeEvent('scroll', document.activeElement || document.body, {
        element_value: 'scroll_y=' + window.scrollY,
      })
    }, 3000)
  }, { capture: true, passive: true })

    // ── Initial navigate event ────────────────────────────────────────────────────
    ; (function sendInitialNavigate() {
      const evt = buildBase('navigate', document.body)
      evt.element_selector = 'document'
      postEvent(evt)
    })()

})()
