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
    console.warn('[Lynkk] No data-url found on script tag. Tracking disabled.')
    return
  }

  var ENDPOINT = supabaseUrl + '/functions/v1/track'

  var userEmail = window.__LYNKK_USER_EMAIL || null
  var userName = window.__LYNKK_USER_NAME || null
  var eventQueue = []

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
