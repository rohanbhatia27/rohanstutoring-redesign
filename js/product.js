/* ============================================
   PRODUCT PAGE JS — product.js
   Handles sticky bar show/hide on scroll
   ============================================ */

(function (global) {
  const MINUTE_IN_MS = 60 * 1000;
  const HOUR_IN_MS = 60 * MINUTE_IN_MS;
  const DAY_IN_MS = 24 * HOUR_IN_MS;

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

  function getCountdownParts(targetDate, nowDate = new Date()) {
    const targetTime = targetDate instanceof Date ? targetDate.getTime() : Number(targetDate);
    const nowTime = nowDate instanceof Date ? nowDate.getTime() : Number(nowDate);

    if (!Number.isFinite(targetTime) || !Number.isFinite(nowTime)) {
      return null;
    }

    const remainingMs = targetTime - nowTime;

    if (remainingMs <= 0) {
      return {
        isComplete: true,
        days: 0,
        hours: 0,
        minutes: 0,
      };
    }

    return {
      isComplete: false,
      days: Math.floor(remainingMs / DAY_IN_MS),
      hours: Math.floor((remainingMs % DAY_IN_MS) / HOUR_IN_MS),
      minutes: Math.floor((remainingMs % HOUR_IN_MS) / MINUTE_IN_MS),
    };
  }

  function padCountdownUnit(value) {
    return String(value).padStart(2, '0');
  }

  function getCountdownAriaLabel(parts, completeText) {
    if (parts.isComplete) return completeText;

    const dayLabel = parts.days === 1 ? 'day' : 'days';
    const hourLabel = parts.hours === 1 ? 'hour' : 'hours';
    const minuteLabel = parts.minutes === 1 ? 'minute' : 'minutes';

    return `Live classes start in ${parts.days} ${dayLabel}, ${parts.hours} ${hourLabel}, ${parts.minutes} ${minuteLabel}`;
  }

  function renderCountdown(element, parts, completeText = 'Starts today') {
    if (!element || !parts) return;

    const fallback = element.querySelector('[data-countdown-fallback]');
    const timer = element.querySelector('[data-countdown-timer]');
    const days = element.querySelector('[data-countdown-days]');
    const hours = element.querySelector('[data-countdown-hours]');
    const minutes = element.querySelector('[data-countdown-minutes]');

    element.setAttribute('aria-label', getCountdownAriaLabel(parts, completeText));
    element.classList.toggle('countdown-badge--complete', parts.isComplete);

    if (parts.isComplete) {
      if (fallback) {
        fallback.hidden = false;
        fallback.textContent = completeText;
      }
      if (timer) timer.hidden = true;
      return;
    }

    if (fallback) fallback.hidden = true;
    if (timer) timer.hidden = false;
    if (days) days.textContent = String(parts.days);
    if (hours) hours.textContent = padCountdownUnit(parts.hours);
    if (minutes) minutes.textContent = padCountdownUnit(parts.minutes);
  }

  function createCountdownController(element, options = {}) {
    const windowObject = options.windowObject || global;
    const targetValue = options.target || element?.dataset?.countdownTarget;
    const targetDate = targetValue instanceof Date ? targetValue : new Date(targetValue);
    const completeText = options.completeText || element?.dataset?.countdownComplete || 'Starts today';
    let intervalId = null;

    const update = () => {
      const parts = getCountdownParts(targetDate, new Date());

      if (!parts) return;

      renderCountdown(element, parts, completeText);

      if (parts.isComplete && intervalId !== null && typeof windowObject.clearInterval === 'function') {
        windowObject.clearInterval(intervalId);
        intervalId = null;
      }
    };

    update();

    if (typeof windowObject.setInterval === 'function') {
      intervalId = windowObject.setInterval(update, MINUTE_IN_MS);
    }

    return {
      destroy() {
        if (intervalId !== null && typeof windowObject.clearInterval === 'function') {
          windowObject.clearInterval(intervalId);
          intervalId = null;
        }
      },
      update,
    };
  }

  function initCountdowns() {
    if (typeof document === 'undefined') return [];

    return Array.from(document.querySelectorAll('[data-countdown]'), (element) =>
      createCountdownController(element)
    );
  }

  function initProductPage() {
    if (typeof document === 'undefined') return null;

    const stickyBar = document.getElementById('stickyBar');
    const hero = document.querySelector('.product-hero');
    const countdowns = initCountdowns();

    if (!stickyBar || !hero) {
      return {
        countdowns,
        stickyBar: null,
        destroy() {
          countdowns.forEach((controller) => controller.destroy());
        },
      };
    }

    const stickyBarController = createStickyBarController(stickyBar, hero);

    return {
      countdowns,
      stickyBar: stickyBarController,
      destroy() {
        stickyBarController.destroy();
        countdowns.forEach((controller) => controller.destroy());
      },
    };
  }

  const exported = {
    shouldShowStickyBar,
    syncStickyBar,
    createStickyBarController,
    getCountdownParts,
    padCountdownUnit,
    renderCountdown,
    createCountdownController,
    initCountdowns,
    initProductPage,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
  }

  if (typeof window !== 'undefined') {
    window.ProductPage = exported;

    const startProductPage = () => {
      window.ProductPageController = initProductPage();
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', startProductPage, { once: true });
    } else {
      startProductPage();
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
