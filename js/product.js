/* ============================================
   PRODUCT PAGE JS — product.js
   Handles sticky bar show/hide on scroll
   ============================================ */

(function (global) {
  function shouldShowStickyBar(heroRect, revealOffset = 100) {
    if (!heroRect || typeof heroRect.bottom !== 'number') return false;
    return heroRect.bottom <= revealOffset;
  }

  function syncStickyBar(stickyBar, hero, revealOffset = 100) {
    const isVisible = shouldShowStickyBar(hero.getBoundingClientRect(), revealOffset);
    stickyBar.classList.toggle('visible', isVisible);
  }

  function createStickyBarController(stickyBar, hero, options = {}) {
    const revealOffset = options.revealOffset ?? 100;
    const windowObject = options.windowObject || global;
    let frameId = null;
    let resizeObserver = null;

    const update = () => {
      frameId = null;
      syncStickyBar(stickyBar, hero, revealOffset);
    };

    const requestUpdate = () => {
      if (frameId !== null) return;

      if (typeof windowObject.requestAnimationFrame === 'function') {
        frameId = windowObject.requestAnimationFrame(update);
        return;
      }

      update();
    };

    windowObject.addEventListener('scroll', requestUpdate, { passive: true });
    windowObject.addEventListener('resize', requestUpdate);
    windowObject.addEventListener('load', requestUpdate);

    if (typeof windowObject.ResizeObserver === 'function') {
      resizeObserver = new windowObject.ResizeObserver(requestUpdate);
      resizeObserver.observe(hero);
    }

    requestUpdate();

    return {
      destroy() {
        windowObject.removeEventListener('scroll', requestUpdate);
        windowObject.removeEventListener('resize', requestUpdate);
        windowObject.removeEventListener('load', requestUpdate);
        if (resizeObserver) resizeObserver.disconnect();
        if (frameId !== null && typeof windowObject.cancelAnimationFrame === 'function') {
          windowObject.cancelAnimationFrame(frameId);
        }
      },
      update: requestUpdate,
    };
  }

  function initProductPage() {
    if (typeof document === 'undefined') return null;

    const stickyBar = document.getElementById('stickyBar');
    const hero = document.querySelector('.product-hero');

    if (!stickyBar || !hero) return null;

    return createStickyBarController(stickyBar, hero);
  }

  const exported = {
    shouldShowStickyBar,
    syncStickyBar,
    createStickyBarController,
    initProductPage,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
  }

  if (typeof window !== 'undefined') {
    window.ProductPage = exported;
    document.addEventListener('DOMContentLoaded', initProductPage);
  }
})(typeof window !== 'undefined' ? window : globalThis);
