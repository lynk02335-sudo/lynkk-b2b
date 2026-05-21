/**
 * Lynkk Tracker Script
 *
 * Usage:
 * <script src="/track.js" data-key="YOUR_API_KEY" data-url="https://<project>.supabase.co"></script>
 *
 * <script>
 *   Lynkk.identify("user@email.com", "User Name")
 *   Lynkk.track("page_view", { custom: "property" })
 * </script>
 */

(function() {
  var scripts = document.getElementsByTagName('script')
  var apiKey = null
  var supabaseUrl = null

  for (var i = 0; i < scripts.length; i++) {
    if (scripts[i].src && scripts[i].src.includes('track.js')) {
      apiKey = scripts[i].getAttribute('data-key')
      supabaseUrl = scripts[i].getAttribute('data-url')
      break
    }
  }

  if (!apiKey) {
    console.warn('[Lynkk] No data-key found on script tag. Tracking disabled.')
    return
  }

  if (!supabaseUrl) {
    console.warn('[Lynkk] No data-url on script tag — add data-url="https://<project>.supabase.co" to your script tag.')
    return
  }

  var ENDPOINT = supabaseUrl.replace(/\/$/, '') + '/functions/v1/track'
  var CAMPAIGNS_ENDPOINT = supabaseUrl.replace(/\/$/, '') + '/functions/v1/get-campaigns'
  var RECOMMENDATIONS_ENDPOINT = supabaseUrl.replace(/\/$/, '') + '/functions/v1/get-recommendations'

  var userEmail = window.__LYNKK_USER_EMAIL || null
  var userName = window.__LYNKK_USER_NAME || null
  var eventQueue = []

  // ─── PERSONALIZATION ────────────────────────────────────────

  // once_per_session: sessionStorage; once (ever): localStorage
  var sessionSeen = {}
  var everSeen = {}
  var variantAssignments = {}
  try { sessionSeen = JSON.parse(sessionStorage.getItem('__lynkk_seen_s') || '{}') } catch(e) {}
  try { everSeen = JSON.parse(localStorage.getItem('__lynkk_seen_l') || '{}') } catch(e) {}
  try { variantAssignments = JSON.parse(localStorage.getItem('__lynkk_variants') || '{}') } catch(e) {}

  function shouldShow(campaign) {
    var freq = (campaign.display_rules && campaign.display_rules.frequency) || 'once'
    if (freq === 'always') return true
    if (freq === 'once_per_session') return !sessionSeen[campaign.id]
    // 'once' or default
    return !everSeen[campaign.id]
  }

  function markShown(campaignId, freq) {
    if (freq === 'always') return
    if (freq === 'once_per_session') {
      sessionSeen[campaignId] = true
      try { sessionStorage.setItem('__lynkk_seen_s', JSON.stringify(sessionSeen)) } catch(e) {}
    } else {
      everSeen[campaignId] = true
      try { localStorage.setItem('__lynkk_seen_l', JSON.stringify(everSeen)) } catch(e) {}
    }
  }

  // Deterministic variant assignment based on user email + campaign id
  function getVariantId(campaign) {
    if (!campaign.variants || campaign.variants.length === 0) return null
    var key = campaign.id
    if (variantAssignments[key]) return variantAssignments[key]
    // Deterministic hash of user + campaign
    var combined = (userEmail || 'anon') + ':' + campaign.id
    var hash = 0
    for (var i = 0; i < combined.length; i++) {
      var c = combined.charCodeAt(i)
      hash = ((hash << 5) - hash) + c
      hash = hash & hash
    }
    var bucket = Math.abs(hash) % 100
    var cumulative = 0
    var sorted = campaign.variants.slice().sort(function(a, b) { return a.id > b.id ? 1 : -1 })
    for (var j = 0; j < sorted.length; j++) {
      cumulative += sorted[j].traffic_split || 0
      if (bucket < cumulative) {
        variantAssignments[key] = sorted[j].id
        try { localStorage.setItem('__lynkk_variants', JSON.stringify(variantAssignments)) } catch(e) {}
        return sorted[j].id
      }
    }
    // Fallback to first variant
    variantAssignments[key] = sorted[0].id
    try { localStorage.setItem('__lynkk_variants', JSON.stringify(variantAssignments)) } catch(e) {}
    return sorted[0].id
  }

  // Get variant content for a campaign, falling back to base content
  function getVariantContent(campaign) {
    var variantId = getVariantId(campaign)
    if (!variantId) return { content: campaign.content || {}, variant_id: null }
    var variant = null
    for (var i = 0; i < (campaign.variants || []).length; i++) {
      if (campaign.variants[i].id === variantId) {
        variant = campaign.variants[i]
        break
      }
    }
    if (!variant) return { content: campaign.content || {}, variant_id: null }
    // Merge variant content over base content
    return {
      content: {
        ...(campaign.content || {}),
        ...(variant.content || {}),
      },
      variant_id: variantId,
    }
  }

  function trackCampaignEvent(campaignId, eventType, variantId) {
    var payload = {
      api_key: apiKey,
      campaign_id: campaignId,
      user_email: userEmail,
      event_type: eventType,
      url: window.location.href,
    }
    if (variantId) payload.variant_id = variantId
    fetch(CAMPAIGNS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(function() {})
  }

  function loadCampaigns() {
    if (!userEmail) return
    var url = CAMPAIGNS_ENDPOINT +
      '?api_key=' + encodeURIComponent(apiKey) +
      '&user_email=' + encodeURIComponent(userEmail) +
      '&url=' + encodeURIComponent(window.location.pathname)

    fetch(url)
      .then(function(res) { return res.json() })
      .then(function(data) {
        if (!data.campaigns) return
        data.campaigns.forEach(function(campaign) {
          if (!shouldShow(campaign)) return
          renderCampaign(campaign)
        })
      })
      .catch(function() {})
  }

  // Shadow DOM for style isolation
  function createShadowContainer(id, styles) {
    var container = document.createElement('div')
    container.id = id
    container.setAttribute('style', 'all:initial;display:block;')
    var shadow = container.attachShadow({ mode: 'open' })
    // Inject basic reset + font into shadow DOM
    var resetStyle = document.createElement('style')
    resetStyle.textContent = ':host{all:initial;display:block;font-family:system-ui,-apple-system,sans-serif;font-size:14px;line-height:1.5;color:#111}*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}' + (styles || '')
    shadow.appendChild(resetStyle)
    return { container: container, shadow: shadow }
  }

  function renderCampaign(campaign) {
    var resolved = getVariantContent(campaign)
    var content = resolved.content
    var variantId = resolved.variant_id
    var rules = campaign.display_rules || {}
    var delay = (rules.delay_seconds || 0) * 1000
    setTimeout(function() {
      if (campaign.type === 'BANNER') renderBanner(campaign, content, rules, variantId)
      else if (campaign.type === 'MODAL') renderModal(campaign, content, rules, variantId)
      else if (campaign.type === 'TOOLTIP') renderTooltip(campaign, content, rules, variantId)
      else if (campaign.type === 'INLINE') renderInline(campaign, content, rules, variantId)
      else if (campaign.type === 'RECOMMENDATIONS') renderRecommendations(campaign, content, rules, variantId)
    }, delay)
  }

  function inlineStyle(obj) {
    return Object.keys(obj).map(function(k) {
      return k.replace(/([A-Z])/g, function(m) { return '-' + m.toLowerCase() }) + ':' + obj[k]
    }).join(';')
  }

  function renderBanner(campaign, content, rules, variantId) {
    var containerId = 'lynkk-banner-' + campaign.id
    if (document.getElementById(containerId)) return
    ;(function(vId) {
    var sc = createShadowContainer(containerId)
    var root = sc.shadow
    var el = document.createElement('div')
    el.setAttribute('style', inlineStyle({
      position: 'fixed', top: '0', left: '0', right: '0',
      zIndex: '2147483647',
      background: content.background_color || '#6366f1',
      color: content.text_color || '#ffffff',
      padding: '12px 16px', display: 'flex',
      alignItems: 'center', justifyContent: 'space-between',
      fontSize: '14px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
    }))
    var textSpan = document.createElement('span')
    textSpan.textContent = content.headline || content.body || ''
    el.appendChild(textSpan)
    var right = document.createElement('div')
    right.setAttribute('style', 'display:flex;align-items:center;gap:12px')
    if (content.cta_text) {
      var btn = document.createElement('a')
      btn.href = content.cta_url || '#'
      btn.textContent = content.cta_text
      btn.setAttribute('style', inlineStyle({
        background: content.cta_bg || 'rgba(255,255,255,0.2)',
        color: content.text_color || '#ffffff',
        padding: '6px 14px', borderRadius: '6px',
        textDecoration: 'none', fontWeight: '600', fontSize: '13px', cursor: 'pointer'
      }))
      btn.addEventListener('click', function() { trackCampaignEvent(campaign.id, 'CLICK', vId) })
      right.appendChild(btn)
    }
    var close = document.createElement('button')
    close.textContent = '✕'
    close.setAttribute('style', 'background:none;border:none;color:inherit;cursor:pointer;font-size:16px;padding:0 4px;opacity:0.8')
    close.addEventListener('click', function() { sc.container.remove(); trackCampaignEvent(campaign.id, 'DISMISSED', vId) })
    right.appendChild(close)
    el.appendChild(right)
    root.appendChild(el)
    document.body.appendChild(sc.container)
    markShown(campaign.id, rules.frequency || 'once')
    trackCampaignEvent(campaign.id, 'IMPRESSION', vId)
    })(variantId)
  }

  function renderModal(campaign, content, rules, variantId) {
    var containerId = 'lynkk-modal-' + campaign.id
    if (document.getElementById(containerId)) return
    ;(function(vId) {
    var sc = createShadowContainer(containerId)
    var root = sc.shadow
    var overlay = document.createElement('div')
    overlay.setAttribute('style', 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:2147483646;display:flex;align-items:center;justify-content:center')
    var box = document.createElement('div')
    box.setAttribute('style', inlineStyle({
      background: content.background_color || '#ffffff',
      color: content.text_color || '#111111',
      borderRadius: '12px', padding: '32px', maxWidth: '480px', width: '90%',
      boxShadow: '0 20px 60px rgba(0,0,0,0.3)', position: 'relative'
    }))
    var closeBtn = document.createElement('button')
    closeBtn.textContent = '✕'
    closeBtn.setAttribute('style', 'position:absolute;top:12px;right:16px;background:none;border:none;cursor:pointer;font-size:20px;opacity:0.5')
    closeBtn.addEventListener('click', function() { sc.container.remove(); trackCampaignEvent(campaign.id, 'DISMISSED', vId) })
    box.appendChild(closeBtn)
    if (content.headline) {
      var title = document.createElement('h2')
      title.textContent = content.headline
      title.setAttribute('style', 'margin:0 0 12px;font-size:20px;font-weight:700')
      box.appendChild(title)
    }
    var body = document.createElement('p')
    body.textContent = content.body || ''
    body.setAttribute('style', 'margin:0 0 20px;font-size:15px;line-height:1.5;opacity:0.8')
    box.appendChild(body)
    if (content.cta_text) {
      var btn = document.createElement('a')
      btn.href = content.cta_url || '#'
      btn.textContent = content.cta_text
      btn.setAttribute('style', inlineStyle({
        display: 'inline-block',
        background: content.cta_bg || '#6366f1',
        color: '#ffffff', padding: '10px 24px',
        borderRadius: '8px', textDecoration: 'none', fontWeight: '600', fontSize: '14px'
      }))
      btn.addEventListener('click', function() { trackCampaignEvent(campaign.id, 'CLICK', vId); sc.container.remove() })
      box.appendChild(btn)
    }
    overlay.appendChild(box)
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) { sc.container.remove(); trackCampaignEvent(campaign.id, 'DISMISSED', vId) }
    })
    root.appendChild(overlay)
    document.body.appendChild(sc.container)
    markShown(campaign.id, rules.frequency || 'once')
    trackCampaignEvent(campaign.id, 'IMPRESSION', vId)
    })(variantId)
  }

  function renderTooltip(campaign, content, rules, variantId) {
    var selector = rules.target_selector || content.target_selector
    if (!selector) return
    var target = document.querySelector(selector)
    if (!target) return
    var containerId = 'lynkk-tooltip-' + campaign.id
    if (document.getElementById(containerId)) return
    ;(function(vId) {
    var rect = target.getBoundingClientRect()
    var sc = createShadowContainer(containerId)
    var root = sc.shadow
    var tooltip = document.createElement('div')
    tooltip.setAttribute('style', inlineStyle({
      position: 'fixed',
      top: (rect.bottom + 8) + 'px',
      left: rect.left + 'px',
      zIndex: '2147483647',
      background: content.background_color || '#1e293b',
      color: content.text_color || '#ffffff',
      padding: '10px 14px', borderRadius: '8px', fontSize: '13px',
      maxWidth: '260px', boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
    }))
    var closeBtn = document.createElement('button')
    closeBtn.textContent = '✕'
    closeBtn.setAttribute('style', 'float:right;background:none;border:none;color:inherit;cursor:pointer;opacity:0.7;font-size:12px;padding:0 0 0 8px')
    closeBtn.addEventListener('click', function() { sc.container.remove(); trackCampaignEvent(campaign.id, 'DISMISSED', vId) })
    tooltip.appendChild(closeBtn)
    var msg = document.createElement('span')
    msg.textContent = content.headline || content.body || ''
    tooltip.appendChild(msg)
    if (content.cta_text) {
      var btn = document.createElement('a')
      btn.href = content.cta_url || '#'
      btn.textContent = content.cta_text
      btn.setAttribute('style', 'display:block;margin-top:8px;color:' + (content.cta_color || '#93c5fd') + ';text-decoration:none;font-weight:600')
      btn.addEventListener('click', function() { trackCampaignEvent(campaign.id, 'CLICK', vId) })
      tooltip.appendChild(btn)
    }
    root.appendChild(tooltip)
    document.body.appendChild(sc.container)
    markShown(campaign.id, rules.frequency || 'once')
    trackCampaignEvent(campaign.id, 'IMPRESSION', vId)
    })(variantId)
  }

  function renderInline(campaign, content, rules, variantId) {
    var selector = rules.target_selector || content.target_selector
    if (!selector) return
    var target = document.querySelector(selector)
    if (!target) return
    var containerId = 'lynkk-inline-' + campaign.id
    if (document.getElementById(containerId)) return
    ;(function(vId) {
    var sc = createShadowContainer(containerId)
    var root = sc.shadow
    var el = document.createElement('div')
    el.setAttribute('style', inlineStyle({
      background: content.background_color || '#f0f9ff',
      color: content.text_color || '#0c4a6e',
      padding: '16px', borderRadius: '8px',
      fontSize: '14px', margin: '8px 0',
      border: '1px solid ' + (content.border_color || '#bae6fd')
    }))
    if (content.headline) {
      var heading = document.createElement('strong')
      heading.textContent = content.headline
      heading.setAttribute('style', 'display:block;margin-bottom:4px')
      el.appendChild(heading)
    }
    var bodySpan = document.createElement('span')
    bodySpan.textContent = content.body || ''
    el.appendChild(bodySpan)
    if (content.cta_text) {
      var btn = document.createElement('a')
      btn.href = content.cta_url || '#'
      btn.textContent = content.cta_text
      btn.setAttribute('style', 'display:inline-block;margin-top:8px;color:' + (content.cta_color || '#0284c7') + ';text-decoration:underline;font-weight:600')
      btn.addEventListener('click', function() { trackCampaignEvent(campaign.id, 'CLICK', vId) })
      el.appendChild(btn)
    }
    root.appendChild(el)
    // Position the shadow DOM container relative to target
    var pos = rules.position || 'before'
    if (pos === 'inside') target.appendChild(sc.container)
    else if (pos === 'after') target.parentNode && target.parentNode.insertBefore(sc.container, target.nextSibling)
    else target.parentNode && target.parentNode.insertBefore(sc.container, target)
    markShown(campaign.id, rules.frequency || 'once')
    trackCampaignEvent(campaign.id, 'IMPRESSION', vId)
    })(variantId)
  }

  // ─── RECOMMENDATIONS ────────────────────────────────────────

  function trackRecEvent(itemId, eventType, strategy) {
    var payload = {
      api_key: apiKey,
      event: 'recommendation.' + eventType.toLowerCase(),
      user_email: userEmail,
      properties: {
        item_id: itemId,
        strategy: strategy || '',
        url: window.location.href
      }
    }
    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(function() {})
  }

  function renderRecommendations(campaign, content, rules, variantId) {
    var containerId = 'lynkk-rec-' + campaign.id
    if (document.getElementById(containerId)) return

    var strategy = (content && content.strategy) || ''
    var itemCount = (content && content.item_count) || 4
    var url = RECOMMENDATIONS_ENDPOINT +
      '?api_key=' + encodeURIComponent(apiKey) +
      '&user_email=' + encodeURIComponent(userEmail) +
      '&strategy=' + encodeURIComponent(strategy)

    fetch(url)
      .then(function(res) { return res.json() })
      .then(function(data) {
        if (!data.items || data.items.length === 0) return
        var items = data.items.slice(0, itemCount)
        renderRecGrid(campaign, items, data.strategies || [strategy], variantId)
      })
      .catch(function() {})
  }

  function renderRecGrid(campaign, items, strategies, variantId) {
    var containerId = 'lynkk-rec-' + campaign.id
    if (document.getElementById(containerId)) return

    var sc = createShadowContainer(containerId)
    var root = sc.shadow
    var el = document.createElement('div')
    el.setAttribute('style', inlineStyle({
      display: 'grid',
      gridTemplateColumns: 'repeat(' + Math.min(items.length, 4) + ', 1fr)',
      gap: '16px',
      padding: '16px',
      background: (campaign.content && campaign.content.background_color) || '#ffffff',
      borderRadius: '12px',
      margin: '8px 0',
      border: '1px solid #e2e8f0'
    }))

    for (var i = 0; i < items.length; i++) {
      var item = items[i]
      var card = document.createElement('div')
      card.setAttribute('style', inlineStyle({
        cursor: 'pointer',
        borderRadius: '8px',
        overflow: 'hidden',
        border: '1px solid #f1f5f9',
        transition: 'box-shadow 0.2s'
      }))
      card.onmouseenter = function() { this.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)' }
      card.onmouseleave = function() { this.style.boxShadow = 'none' }

      if (item.image_url) {
        var img = document.createElement('img')
        img.src = item.image_url
        img.alt = item.name || ''
        img.setAttribute('style', 'width:100%;height:140px;object-fit:cover;display:block')
        card.appendChild(img)
      }

      var info = document.createElement('div')
      info.setAttribute('style', 'padding:10px')

      var nameEl = document.createElement('div')
      nameEl.textContent = item.name || item.external_id || ''
      nameEl.setAttribute('style', 'font-weight:600;font-size:13px;margin-bottom:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap')
      info.appendChild(nameEl)

      if (item.price != null) {
        var priceEl = document.createElement('div')
        priceEl.textContent = '$' + Number(item.price).toFixed(2)
        priceEl.setAttribute('style', 'font-size:12px;color:#64748b')
        info.appendChild(priceEl)
      }

      card.appendChild(info)

      card.addEventListener('click', function(clickedItem) {
        return function() {
          trackRecEvent(clickedItem.id, 'CLICKED', strategies[0])
          if (clickedItem.url) window.open(clickedItem.url, '_blank')
        }
      }(item))

      el.appendChild(card)

      // Track impression
      trackRecEvent(item.id, 'SHOWN', strategies[0])
    }

    root.appendChild(el)

    var selector = (campaign.display_rules && campaign.display_rules.target_selector) || (campaign.content && campaign.content.target_selector)
    if (selector) {
      var target = document.querySelector(selector)
      if (target) {
        var pos = (campaign.display_rules && campaign.display_rules.position) || 'before'
        if (pos === 'inside') target.appendChild(sc.container)
        else if (pos === 'after') target.parentNode && target.parentNode.insertBefore(sc.container, target.nextSibling)
        else target.parentNode && target.parentNode.insertBefore(sc.container, target)
        return
      }
    }

    // Fallback: append to body with positioning
    sc.container.setAttribute('style', 'position:fixed;bottom:16px;right:16px;max-width:400px;z-index:2147483647')
    document.body.appendChild(sc.container)
  }

  function send(eventName, properties, isRetry) {
    if (!userEmail && eventName !== 'identify') {
      eventQueue.push({ eventName: eventName, properties: properties })
      return
    }

    var payload = {
      api_key: apiKey,
      event: eventName,
      user_email: userEmail,
      user_name: userName,
      properties: properties || {}
    }

    // Revenue event detection
    if (properties && properties.value != null) {
      payload.revenue_value = properties.value
      payload.currency = properties.currency || 'USD'
      payload.is_revenue_event = true
    }
    if (properties && properties.mrr_change != null) {
      payload.revenue_value = properties.mrr_change
      payload.currency = 'USD'
      payload.is_revenue_event = true
    }

    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(function(res) {
      if (!res.ok) throw new Error('HTTP ' + res.status)
    })
    .catch(function(err) {
      if (!isRetry) {
        setTimeout(function() { send(eventName, properties, true) }, 2000)
      }
    })
  }

  // Global identify function
  window.Lynkk = {
    identify: function(email, name) {
      if (!email) return
      userEmail = email
      userName = name || null
      window.__LYNKK_USER_EMAIL = email
      window.__LYNKK_USER_NAME = name
      send('identify', { email: email, name: name })
      // Flush events that were queued before identify was called
      var queued = eventQueue.splice(0)
      queued.forEach(function(e) { send(e.eventName, e.properties) })
      // Load personalization campaigns for the current page
      loadCampaigns()
    },
    track: function(eventName, properties) {
      send(eventName, properties)
    }
  }

  // Auto-track initial page view
  setTimeout(function() {
    send('page_view', {
      page: window.location.pathname,
      referrer: document.referrer,
      title: document.title
    })
  }, 100)

  // Auto-track SPA route changes via History API (no polling)
  var lastPath = window.location.pathname

  function onRouteChange() {
    if (window.location.pathname !== lastPath) {
      lastPath = window.location.pathname
      send('page_view', {
        page: window.location.pathname,
        title: document.title
      })
      // Re-check campaigns on navigation — different pages may trigger different ones
      loadCampaigns()
    }
  }

  var _pushState = history.pushState
  history.pushState = function() {
    _pushState.apply(history, arguments)
    onRouteChange()
  }

  var _replaceState = history.replaceState
  history.replaceState = function() {
    _replaceState.apply(history, arguments)
    onRouteChange()
  }

  window.addEventListener('popstate', onRouteChange)
})()
