(function() {
  // Read API key from script tag
  var scripts = document.getElementsByTagName('script')
  var apiKey = null
  
  for (var i = 0; i < scripts.length; i++) {
    if (scripts[i].src && scripts[i].src.includes('track.js')) {
      apiKey = scripts[i].getAttribute('data-key')
      break
    }
  }
  
  if (!apiKey) {
    console.warn('[Lynkk] No data-key found on script tag. Tracking disabled.')
    return
  }

  var ENDPOINT = 'https://civoslfcdvkohkgwdrnc.supabase.co/functions/v1/track'
  var userEmail = window.__LYNKK_USER_EMAIL || null
  var userName = window.__LYNKK_USER_NAME || null

  function send(eventName, properties) {
    if (!userEmail) {
      // Queue event until user is identified
      return
    }

    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        event: eventName,
        user_email: userEmail,
        user_name: userName,
        properties: properties || {}
      })
    })
    .then(function(res) {
      if (!res.ok) console.warn('[Lynkk] Track failed:', res.status)
    })
    .catch(function(err) {
      console.warn('[Lynkk] Track error:', err)
    })
  }

  // Global identify function — customer calls this after login
  window.Lynkk = {
    identify: function(email, name) {
      userEmail = email
      userName = name || null
      window.__LYNKK_USER_EMAIL = email
      window.__LYNKK_USER_NAME = name
      send('identify', { email: email, name: name })
    },
    track: function(eventName, properties) {
      send(eventName, properties)
    }
  }

  // Auto-track page view
  send('page_view', {
    page: window.location.pathname,
    referrer: document.referrer,
    title: document.title
  })

  // Auto-track page changes (for SPAs)
  var lastPath = window.location.pathname
  setInterval(function() {
    if (window.location.pathname !== lastPath) {
      lastPath = window.location.pathname
      send('page_view', {
        page: window.location.pathname,
        title: document.title
      })
    }
  }, 500)

  console.log('[Lynkk] Tracker initialized')
})()