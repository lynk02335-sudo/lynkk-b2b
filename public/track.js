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

  var userEmail = window.__LYNKK_USER_EMAIL || null
  var userName = window.__LYNKK_USER_NAME || null
  var eventQueue = []

  // ─── PERSONALIZATION ────────────────────────────────────────

  // once_per_session: sessionStorage; once (ever): localStorage
  var sessionSeen = {}
  var everSeen = {}
  try { sessionSeen = JSON.parse(sessionStorage.getItem('__lynkk_seen_s') || '{}') } catch(e) {}
  try { everSeen = JSON.parse(localStorage.getItem('__lynkk_seen_l') || '{}') } catch(e) {}

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

  function trackCampaignEvent(campaignId, eventType) {
    fetch(CAMPAIGNS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        campaign_id: campaignId,
        user_email: userEmail,
        event_type: eventType,
        url: window.location.href
      })
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

  function renderCampaign(campaign) {
    var content = campaign.content || {}
    var rules = campaign.display_rules || {}
    var delay = (rules.delay_seconds || 0) * 1000
    setTimeout(function() {
      if (campaign.type === 'BANNER') renderBanner(campaign, content, rules)
      else if (campaign.type === 'MODAL') renderModal(campaign, content, rules)
      else if (campaign.type === 'TOOLTIP') renderTooltip(campaign, content, rules)
      else if (campaign.type === 'INLINE') renderInline(campaign, content, rules)
    }, delay)
  }

  function inlineStyle(obj) {
    return Object.keys(obj).map(function(k) {
      return k.replace(/([A-Z])/g, function(m) { return '-' + m.toLowerCase() }) + ':' + obj[k]
    }).join(';')
  }

  function renderBanner(campaign, content, rules) {
    if (document.getElementById('lynkk-banner-' + campaign.id)) return
    var el = document.createElement('div')
    el.id = 'lynkk-banner-' + campaign.id
    el.setAttribute('style', inlineStyle({
      position: 'fixed', top: '0', left: '0', right: '0',
      zIndex: '2147483647',
      background: content.background_color || '#6366f1',
      color: content.text_color || '#ffffff',
      padding: '12px 16px', display: 'flex',
      alignItems: 'center', justifyContent: 'space-between',
      fontFamily: 'system-ui,sans-serif', fontSize: '14px',
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
      btn.addEventListener('click', function() { trackCampaignEvent(campaign.id, 'CLICK') })
      right.appendChild(btn)
    }
    var close = document.createElement('button')
    close.textContent = '✕'
    close.setAttribute('style', 'background:none;border:none;color:inherit;cursor:pointer;font-size:16px;padding:0 4px;opacity:0.8')
    close.addEventListener('click', function() { el.remove(); trackCampaignEvent(campaign.id, 'DISMISSED') })
    right.appendChild(close)
    el.appendChild(right)
    document.body.appendChild(el)
    markShown(campaign.id, rules.frequency || 'once')
    trackCampaignEvent(campaign.id, 'IMPRESSION')
  }

  function renderModal(campaign, content, rules) {
    if (document.getElementById('lynkk-modal-' + campaign.id)) return
    var overlay = document.createElement('div')
    overlay.id = 'lynkk-modal-' + campaign.id
    overlay.setAttribute('style', 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:2147483646;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif')
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
    closeBtn.addEventListener('click', function() { overlay.remove(); trackCampaignEvent(campaign.id, 'DISMISSED') })
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
      btn.addEventListener('click', function() { trackCampaignEvent(campaign.id, 'CLICK'); overlay.remove() })
      box.appendChild(btn)
    }
    overlay.appendChild(box)
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) { overlay.remove(); trackCampaignEvent(campaign.id, 'DISMISSED') }
    })
    document.body.appendChild(overlay)
    markShown(campaign.id, rules.frequency || 'once')
    trackCampaignEvent(campaign.id, 'IMPRESSION')
  }

  function renderTooltip(campaign, content, rules) {
    var selector = rules.target_selector || content.target_selector
    if (!selector) return
    var target = document.querySelector(selector)
    if (!target) return
    if (document.getElementById('lynkk-tooltip-' + campaign.id)) return
    var rect = target.getBoundingClientRect()
    var tooltip = document.createElement('div')
    tooltip.id = 'lynkk-tooltip-' + campaign.id
    tooltip.setAttribute('style', inlineStyle({
      position: 'fixed',
      top: (rect.bottom + 8) + 'px',
      left: rect.left + 'px',
      zIndex: '2147483647',
      background: content.background_color || '#1e293b',
      color: content.text_color || '#ffffff',
      padding: '10px 14px', borderRadius: '8px', fontSize: '13px',
      maxWidth: '260px', boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
      fontFamily: 'system-ui,sans-serif'
    }))
    var closeBtn = document.createElement('button')
    closeBtn.textContent = '✕'
    closeBtn.setAttribute('style', 'float:right;background:none;border:none;color:inherit;cursor:pointer;opacity:0.7;font-size:12px;padding:0 0 0 8px')
    closeBtn.addEventListener('click', function() { tooltip.remove(); trackCampaignEvent(campaign.id, 'DISMISSED') })
    tooltip.appendChild(closeBtn)
    var msg = document.createElement('span')
    msg.textContent = content.headline || content.body || ''
    tooltip.appendChild(msg)
    if (content.cta_text) {
      var btn = document.createElement('a')
      btn.href = content.cta_url || '#'
      btn.textContent = content.cta_text
      btn.setAttribute('style', 'display:block;margin-top:8px;color:' + (content.cta_color || '#93c5fd') + ';text-decoration:none;font-weight:600')
      btn.addEventListener('click', function() { trackCampaignEvent(campaign.id, 'CLICK') })
      tooltip.appendChild(btn)
    }
    document.body.appendChild(tooltip)
    markShown(campaign.id, rules.frequency || 'once')
    trackCampaignEvent(campaign.id, 'IMPRESSION')
  }

  function renderInline(campaign, content, rules) {
    var selector = rules.target_selector || content.target_selector
    if (!selector) return
    var target = document.querySelector(selector)
    if (!target) return
    if (document.getElementById('lynkk-inline-' + campaign.id)) return
    var el = document.createElement('div')
    el.id = 'lynkk-inline-' + campaign.id
    el.setAttribute('style', inlineStyle({
      background: content.background_color || '#f0f9ff',
      color: content.text_color || '#0c4a6e',
      padding: '16px', borderRadius: '8px',
      fontFamily: 'system-ui,sans-serif', fontSize: '14px', margin: '8px 0',
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
      btn.addEventListener('click', function() { trackCampaignEvent(campaign.id, 'CLICK') })
      el.appendChild(btn)
    }
    var pos = rules.position || 'before'
    if (pos === 'inside') target.appendChild(el)
    else if (pos === 'after') target.parentNode && target.parentNode.insertBefore(el, target.nextSibling)
    else target.parentNode && target.parentNode.insertBefore(el, target)
    markShown(campaign.id, rules.frequency || 'once')
    trackCampaignEvent(campaign.id, 'IMPRESSION')
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
