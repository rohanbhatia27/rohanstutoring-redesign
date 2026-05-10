// Vercel Web Analytics
window.va = window.va || function () { 
  (window.vaq = window.vaq || []).push(arguments); 
};

// Google Analytics
window.dataLayer = window.dataLayer || [];

function gtag() {
  window.dataLayer.push(arguments);
}

window.gtag = window.gtag || gtag;
window.gtag('js', new Date());
window.gtag('config', 'G-H1KDZ561ZE');

(function () {
  const GA_SRC = 'https://www.googletagmanager.com/gtag/js?id=G-H1KDZ561ZE';

  const loadGoogleAnalytics = () => {
    if (document.querySelector(`script[src="${GA_SRC}"]`)) {
      return;
    }

    const script = document.createElement('script');
    script.async = true;
    script.src = GA_SRC;
    document.head.appendChild(script);
  };

  const currentScript = document.currentScript;
  const shouldLoadWhenIdle = currentScript?.dataset.load === 'idle';

  if (!shouldLoadWhenIdle) {
    loadGoogleAnalytics();
    return;
  }

  const loadAfterFirstPaint = () => {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(loadGoogleAnalytics, { timeout: 2500 });
      return;
    }

    window.setTimeout(loadGoogleAnalytics, 1200);
  };

  if (document.readyState === 'complete') {
    loadAfterFirstPaint();
  } else {
    window.addEventListener('load', loadAfterFirstPaint, { once: true });
  }
})();
