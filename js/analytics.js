(function () {
  var PIXEL_ID = '1547122119792751';
  var shouldLoadWhenIdle = !!(document.currentScript && document.currentScript.dataset.load === 'idle');

  var PRODUCT_VIEW_CONTENT = {
    comprehensive: { content_name: 'Comprehensive Course', value: 1699 },
    blueprint: { content_name: "Rohan's Blueprint", value: 599 },
    advanced: { content_name: 'GAMSAT Advanced Series', value: 299 },
    's1-comprehensive': { content_name: 'Section 1 Comprehensive Course', value: 999 },
    's2-comprehensive': { content_name: 'Section 2 Comprehensive Course', value: 999 },
    mastery: { content_name: 'Mastery Program', value: 2249 },
    'private-mentoring': { content_name: 'Private Mentoring', value: 119 },
    'essay-marking': { content_name: 'Essay Marking', value: 35 },
  };

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

  function loadMetaPixelScript() {
    if (window.fbq) return;

    !(function (f, b, e, v, n, t, s) {
      if (f.fbq) return;
      n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n;
      n.push = n;
      n.loaded = !0;
      n.version = '2.0';
      n.queue = [];
      t = b.createElement(e);
      t.async = !0;
      t.src = 'https://connect.facebook.net/en_US/fbevents.js';
      s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    })(window, document, 'script');
  }

  function getProductSlugFromPath() {
    var path = (window.location.pathname || '').toLowerCase();
    var match = path.match(/\/(?:courses|store\/p)\/([^/.]+)/);
    if (!match) return null;
    return match[1].replace(/\.html$/, '');
  }

  function trackViewContentForPath() {
    if (typeof window.fbq !== 'function') return;

    var slug = getProductSlugFromPath();
    if (!slug) return;

    var product = PRODUCT_VIEW_CONTENT[slug];
    if (!product) return;

    window.fbq('track', 'ViewContent', {
      content_name: product.content_name,
      content_ids: [slug],
      content_type: 'product',
      value: product.value,
      currency: 'AUD',
    });
  }

  function initMetaPixel() {
    loadMetaPixelScript();
    window.fbq('init', PIXEL_ID);
    window.fbq('track', 'PageView');
    trackViewContentForPath();
  }

  function initAnalytics() {
    initGA4();
    initMetaPixel();
  }

  var consent = window.__analyticsConsent;
  if (consent && consent.granted) {
    initAnalytics();
  } else if (consent && consent.pending) {
    window.addEventListener('consentGranted', function () {
      initAnalytics();
    }, { once: true });
  }
})();
