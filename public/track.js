/**
 * Lynkk Tracker Script
 * 
 * Usage:
 * <script src="/track.js" data-key="YOUR_API_KEY"></script>
 * 
 * <script>
 *   Lynkk.identify("user@email.com", "User Name")
 *   Lynkk.track("page_view", { custom: "property" })
 * </script>
 */

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

  // Supabase Configuration
  var SUPABASE_URL = 'https://civoslfcdvkohkgwdrnc.supabase.co'
  var ENDPOINT = SUPABASE_URL + '/functions/v1/track'
  
  var userEmail = window.__LYNKK_USER_EMAIL || null
  var userName = window.__LYNKK_USER_NAME || null

  function send(eventName, properties, isRetry) {
    if (!userEmail && eventName !== 'identify') {
      console.log('[Lynkk] Event queued: No user identified yet')
      return
    }

    var payload = {
      api_key: apiKey,
      event: eventName,
      user_email: userEmail,
      user_name: userName,
      properties: properties || {}
    }

    console.log('[Lynkk] Sending event:', payload)

    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(function(res) {
      if (!res.ok) {
        throw new Error('HTTP ' + res.status)
      }
      console.log('[Lynkk] Event success')
    })
    .catch(function(err) {
      console.error('[Lynkk] Event failed:', err)
      
      if (!isRetry) {
        console.log('[Lynkk] Retrying in 2 seconds...')
        setTimeout(function() {
          send(eventName, properties, true)
        }, 2000)
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
    },
    track: function(eventName, properties) {
      send(eventName, properties)
    }
  }

  // Auto-track page view
  console.log('[Lynkk] Tracker initialized')
  
  // Wait a bit to ensure identify might have been called synchronously if at all
  setTimeout(function() {
    send('page_view', {
      page: window.location.pathname,
      referrer: document.referrer,
      title: document.title
    })
  }, 100)

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
  }, 1000)
})()