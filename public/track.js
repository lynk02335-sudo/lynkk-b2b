(function() {
  'use strict';

  var scripts = document.getElementsByTagName('script');
  var currentScript = scripts[scripts.length - 1];
  var apiKey = currentScript.getAttribute('data-key');

  if (!apiKey) {
    console.error('Lynkk: Missing data-key attribute on script tag');
    return;
  }

  var baseUrl = 'https://civoslfcdvkohkgwdrnc.supabase.co/functions/v1/track';

  function trackEvent(eventName, userEmail, properties) {
    var payload = {
      api_key: apiKey,
      event: eventName,
      user_email: userEmail || window.__USER_EMAIL || '',
      properties: properties || {}
    };

    fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }).catch(function(err) {
      console.error('Lynkk tracking error:', err);
    });
  }

  trackEvent('page_view', window.__USER_EMAIL || '', {
    page: window.location.pathname,
    referrer: document.referrer,
    title: document.title
  });

  window.track = trackEvent;

  window Lynkk = {
    track: trackEvent,
    identify: function(userEmail, userData) {
      window.__USER_EMAIL = userEmail;
      if (userData && userData.name) {
        window.__USER_NAME = userData.name;
      }
    }
  };
})();