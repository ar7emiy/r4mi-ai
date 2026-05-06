/**
 * element_resolver.js — selector-free DOM resolution for r4mi.
 *
 * Exposes window.r4mi.resolve(fingerprint) returning { element, confidence }.
 * Strategies are tried in order; the first match >= 0.55 wins. The
 * resolver carries no domain knowledge: it operates purely on accessibility
 * roles, accessible names, ARIA landmarks, and DOM position.
 *
 * Fingerprint shape (matches backend ElementFingerprint):
 *   { role, accessible_name, landmark, surrounding_text,
 *     position_signature, url_pattern }
 */
;(function () {
  'use strict'

  if (window.r4mi && window.r4mi.resolve) return

  // ── Accessibility helpers (mirror capture.js) ──────────────────────────────
  function getAccessibleName(el) {
    if (!el) return ''
    var aria = el.getAttribute && el.getAttribute('aria-label')
    if (aria) return aria.trim()
    var lb = el.getAttribute && el.getAttribute('aria-labelledby')
    if (lb) {
      var ref = document.getElementById(lb)
      if (ref) return (ref.textContent || '').trim().slice(0, 120)
    }
    if (el.labels && el.labels[0]) return (el.labels[0].textContent || '').trim().slice(0, 120)
    var ph = el.getAttribute && el.getAttribute('placeholder')
    if (ph) return ph.trim()
    var ti = el.getAttribute && el.getAttribute('title')
    if (ti) return ti.trim()
    var alt = el.getAttribute && el.getAttribute('alt')
    if (alt) return alt.trim()
    return (el.textContent || '').trim().slice(0, 120)
  }

  function getRole(el) {
    if (!el || !el.getAttribute) return ''
    var explicit = el.getAttribute('role')
    if (explicit) return explicit.toLowerCase()
    var tag = el.tagName.toLowerCase()
    if (tag === 'input') {
      var type = (el.getAttribute('type') || 'text').toLowerCase()
      if (type === 'checkbox') return 'checkbox'
      if (type === 'radio') return 'radio'
      if (type === 'submit' || type === 'button') return 'button'
      return 'textbox'
    }
    var map = {
      a: 'link', button: 'button', textarea: 'textbox', select: 'combobox',
      form: 'form', nav: 'navigation', main: 'main', aside: 'complementary',
      header: 'banner', footer: 'contentinfo', section: 'region',
      h1: 'heading', h2: 'heading', h3: 'heading', h4: 'heading',
      h5: 'heading', h6: 'heading', img: 'image', li: 'listitem',
      ul: 'list', ol: 'list', table: 'table', tr: 'row',
      td: 'cell', th: 'columnheader',
    }
    return map[tag] || tag
  }

  function getLandmark(el) {
    var node = el && el.parentElement
    while (node && node !== document.body) {
      var r = (node.getAttribute('role') || '').toLowerCase()
      if (['main', 'navigation', 'complementary', 'form', 'region', 'banner', 'contentinfo'].indexOf(r) !== -1) return r
      var tag = node.tagName.toLowerCase()
      if (['main', 'nav', 'aside', 'header', 'footer', 'section', 'form'].indexOf(tag) !== -1) return tag
      node = node.parentElement
    }
    return 'body'
  }

  function findLandmarkScope(landmarkName) {
    if (!landmarkName || landmarkName === 'body') return document.body
    var bySel = document.querySelector(landmarkName) ||
                document.querySelector('[role="' + landmarkName + '"]')
    return bySel || document.body
  }

  function normalize(s) {
    return (s || '').toLowerCase().replace(/[\s_\-:.,]+/g, ' ').trim()
  }

  // ── Similarity scoring ─────────────────────────────────────────────────────
  function nameSim(a, b) {
    a = normalize(a); b = normalize(b)
    if (!a || !b) return 0
    if (a === b) return 1.0
    if (a.indexOf(b) !== -1 || b.indexOf(a) !== -1) return 0.85
    // token overlap
    var aTok = a.split(' '); var bTok = b.split(' ')
    var overlap = 0
    for (var i = 0; i < aTok.length; i++) {
      if (bTok.indexOf(aTok[i]) !== -1) overlap++
    }
    var maxLen = Math.max(aTok.length, bTok.length) || 1
    return overlap / maxLen
  }

  function score(el, fp) {
    var elRole = getRole(el)
    var roleMatch = elRole === fp.role ? 1 : (elRole && fp.role && elRole.indexOf(fp.role) !== -1 ? 0.5 : 0)
    var nameMatch = nameSim(getAccessibleName(el), fp.accessible_name)
    var landmarkMatch = getLandmark(el) === fp.landmark ? 1 : 0
    // weight role highest, then accessible name, then landmark
    return 0.45 * roleMatch + 0.4 * nameMatch + 0.15 * landmarkMatch
  }

  function gatherCandidatesByRole(scope, role) {
    if (!scope) return []
    var result = []
    var stack = [scope]
    while (stack.length) {
      var n = stack.pop()
      if (!n || n.nodeType !== 1) continue
      if (n !== scope && getRole(n) === role) result.push(n)
      var children = n.children
      for (var i = 0; i < children.length; i++) stack.push(children[i])
    }
    return result
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  function resolve(fp, root) {
    if (!fp || !fp.role) return { element: null, confidence: 0 }
    var scope = findLandmarkScope(fp.landmark) || root || document.body
    var candidates = gatherCandidatesByRole(scope, fp.role)
    if (candidates.length === 0 && scope !== document.body) {
      candidates = gatherCandidatesByRole(document.body, fp.role)
    }
    if (candidates.length === 0) return { element: null, confidence: 0 }

    var best = null; var bestScore = 0
    for (var i = 0; i < candidates.length; i++) {
      var s = score(candidates[i], fp)
      if (s > bestScore) { bestScore = s; best = candidates[i] }
    }

    // Tie-breaker: position_signature ordinal within scope+role
    if (best && fp.position_signature) {
      var parts = fp.position_signature.split(':')
      if (parts.length === 3) {
        var ordinal = parseInt(parts[2], 10)
        if (!isNaN(ordinal) && candidates.length > ordinal) {
          var posCandidate = candidates[ordinal]
          if (posCandidate && score(posCandidate, fp) >= bestScore - 0.1) {
            best = posCandidate
            bestScore = Math.max(bestScore, 0.7)
          }
        }
      }
    }

    if (bestScore < 0.45) return { element: null, confidence: bestScore }
    return { element: best, confidence: bestScore }
  }

  window.r4mi = window.r4mi || {}
  window.r4mi.resolve = resolve
})()
