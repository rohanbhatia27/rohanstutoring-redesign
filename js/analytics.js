(function () {
  var shouldLoadWhenIdle = !!(document.currentScript && document.currentScript.dataset.load === 'idle');

  function initGA4() {
    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = window.gtag || gtag;
    window.gtag('js', new Date());
    window.gtag('config', 'G-H1KDZ561ZE');

    var GA_SRC = 'https://www.googletagmanager.com/gtag/js?id=G-H1KDZ561ZE';

    function loadGoogleAnalytics() {
      if (document.querySelector('script[src="' + GA_SRC + '"]')) return;
      var script = document.createElement('script');
      script.async = true;
      script.src = GA_SRC;
      document.head.appendChild(script);
    }

    function loadAfterFirstPaint() {
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(loadGoogleAnalytics, { timeout: 2500 });
        return;
      }
      window.setTimeout(loadGoogleAnalytics, 1200);
    }

    if (!shouldLoadWhenIdle) {
      loadGoogleAnalytics();
      return;
    }

    if (document.readyState === 'complete') {
      loadAfterFirstPaint();
    } else {
      window.addEventListener('load', loadAfterFirstPaint, { once: true });
    }
  }

  var consent = window.__analyticsConsent;
  if (consent && consent.granted) {
    initGA4();
  } else if (consent && consent.pending) {
    window.addEventListener('consentGranted', function () { initGA4(); }, { once: true });
  }
})();
