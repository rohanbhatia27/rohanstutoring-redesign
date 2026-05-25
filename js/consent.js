(function () {
  var STORAGE_KEY = 'rohan_analytics_consent';
  var BANNER_ID = 'consent-banner';

  var stored = null;
  try { stored = localStorage.getItem(STORAGE_KEY); } catch (e) {}

  window.__analyticsConsent = {
    granted: stored === 'granted',
    pending: stored === null,
  };

  if (!window.__analyticsConsent.pending) return;

  function buildBanner() {
    if (document.getElementById(BANNER_ID)) return;

    var el = document.createElement('div');
    el.id = BANNER_ID;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Cookie preferences');
    el.innerHTML =
      '<div class="consent-banner__inner">' +
        '<p class="consent-banner__text">We use analytics cookies to understand how visitors use this site. No data is sold or shared. ' +
        '<a href="/privacy" class="consent-banner__link">Privacy policy</a>.</p>' +
        '<div class="consent-banner__actions">' +
          '<button class="consent-banner__btn consent-banner__btn--decline" id="consent-decline" type="button">Decline</button>' +
          '<button class="consent-banner__btn consent-banner__btn--accept" id="consent-accept" type="button">Accept analytics</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(el);

    document.getElementById('consent-accept').addEventListener('click', function () {
      try { localStorage.setItem(STORAGE_KEY, 'granted'); } catch (e) {}
      window.__analyticsConsent.granted = true;
      window.__analyticsConsent.pending = false;
      window.dispatchEvent(new CustomEvent('consentGranted'));
      el.remove();
    });

    document.getElementById('consent-decline').addEventListener('click', function () {
      try { localStorage.setItem(STORAGE_KEY, 'denied'); } catch (e) {}
      window.__analyticsConsent.granted = false;
      window.__analyticsConsent.pending = false;
      el.remove();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildBanner);
  } else {
    buildBanner();
  }
})();
