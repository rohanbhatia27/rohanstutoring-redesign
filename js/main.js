/* ============================================
   ROHAN'S GAMSAT — main.js
   Lightweight interactions + utility JS
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const track = (event, params = {}) => {
    if (typeof window.gtag === 'function') {
      window.gtag('event', event, params);
    }
  };

  /* ---- Nav: transparent → solid on scroll ---- */
  const nav = document.getElementById('nav');
  if (nav) {
    const onScroll = () => {
      nav.classList.toggle('scrolled', window.scrollY > 40);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---- Mobile burger ---- */
  const burger = document.getElementById('burger');
  const mobileMenu = document.getElementById('mobileMenu');
  const mobileResourceWrap = document.querySelector('.nav__mobile-group');
  const mobileResourceTrigger = mobileResourceWrap?.querySelector('.nav__mobile-trigger');
  const mobileResourceMenu = mobileResourceWrap?.querySelector('.nav__mobile-submenu');

  if (burger && mobileMenu) {
    const setMobileResourcesState = (isOpen) => {
      if (!mobileResourceWrap || !mobileResourceTrigger || !mobileResourceMenu) return;
      mobileResourceWrap.classList.toggle('is-open', isOpen);
      mobileResourceTrigger.setAttribute('aria-expanded', String(isOpen));
      mobileResourceMenu.classList.toggle('open', isOpen);
      mobileResourceMenu.hidden = !isOpen;
      mobileResourceMenu.setAttribute('aria-hidden', String(!isOpen));
    };

    const setMobileMenuState = (isOpen) => {
      burger.setAttribute('aria-expanded', String(isOpen));
      burger.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
      burger.setAttribute('aria-controls', mobileMenu.id);
      document.body.classList.toggle('menu-open', isOpen);
      mobileMenu.classList.toggle('open', isOpen);
      mobileMenu.hidden = !isOpen;
      mobileMenu.setAttribute('aria-hidden', String(!isOpen));
      setMobileResourcesState(false);
    };

    setMobileMenuState(mobileMenu.classList.contains('open'));
    setMobileResourcesState(false);

    burger.addEventListener('click', () => {
      setMobileMenuState(!mobileMenu.classList.contains('open'));
    });

    if (mobileResourceTrigger && mobileResourceMenu) {
      mobileResourceTrigger.addEventListener('click', () => {
        setMobileResourcesState(!mobileResourceWrap.classList.contains('is-open'));
      });
    }

    mobileMenu.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => setMobileMenuState(false));
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && mobileMenu.classList.contains('open')) {
        setMobileResourcesState(false);
        setMobileMenuState(false);
        burger.focus();
      }
    });
  }

  /* ---- Desktop resources dropdown ---- */
  const dropdownWrap = document.querySelector('.nav__dropdown-wrap');
  const dropdownTrigger = dropdownWrap?.querySelector('.nav__dropdown-trigger');
  const dropdown = dropdownWrap?.querySelector('.nav__dropdown');

  if (dropdownWrap && dropdownTrigger && dropdown) {
    const dropdownLinks = dropdown.querySelectorAll('a');
    const supportsHover = window.matchMedia('(hover: hover)').matches;

    const setDropdownState = (isOpen) => {
      dropdownWrap.classList.toggle('is-open', isOpen);
      dropdownTrigger.setAttribute('aria-expanded', String(isOpen));
    };

    setDropdownState(false);

    const openDropdown = () => setDropdownState(true);
    const closeDropdown = () => setDropdownState(false);

    dropdownTrigger.addEventListener('click', () => {
      setDropdownState(dropdownTrigger.getAttribute('aria-expanded') !== 'true');
    });

    dropdownTrigger.addEventListener('keydown', (event) => {
      if (event.key === ' ' || event.key === 'Enter' || event.key === 'ArrowDown') {
        event.preventDefault();
        openDropdown();
        dropdownLinks[0]?.focus();
      }

      if (event.key === 'Escape') {
        closeDropdown();
      }
    });

    dropdown.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeDropdown();
        dropdownTrigger.focus();
      }
    });

    dropdownWrap.addEventListener('focusin', openDropdown);
    dropdownWrap.addEventListener('focusout', () => {
      window.setTimeout(() => {
        if (!dropdownWrap.contains(document.activeElement)) {
          closeDropdown();
        }
      }, 0);
    });

    if (supportsHover) {
      dropdownWrap.addEventListener('mouseenter', openDropdown);
      dropdownWrap.addEventListener('mouseleave', () => {
        if (!dropdownWrap.contains(document.activeElement)) {
          closeDropdown();
        }
      });
    }

    document.addEventListener('pointerdown', (event) => {
      if (!dropdownWrap.contains(event.target)) {
        closeDropdown();
      }
    });
  }

  /* ---- Scroll Reveal (CSS-based, lightweight) ---- */
  const reveals = document.querySelectorAll('.reveal');
  if (prefersReducedMotion) {
    reveals.forEach((el) => el.classList.add('visible'));
  } else {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach((el) => revealObserver.observe(el));
  }

  /* ---- Student type selector tabs ---- */
  const tabs = Array.from(document.querySelectorAll('.selector__tab'));
  const panels = Array.from(document.querySelectorAll('.selector__panel'));

  if (tabs.length && panels.length) {
    const activateTab = (nextTab, { focus = false } = {}) => {
      tabs.forEach((tab) => {
        const isSelected = tab === nextTab;
        const panelId = tab.getAttribute('aria-controls');
        const panel = panelId ? document.getElementById(panelId) : null;

        tab.classList.toggle('selector__tab--active', isSelected);
        tab.setAttribute('aria-selected', String(isSelected));
        tab.setAttribute('tabindex', isSelected ? '0' : '-1');

        if (panel) {
          panel.classList.toggle('selector__panel--active', isSelected);
          panel.hidden = !isSelected;
          panel.setAttribute('aria-hidden', String(!isSelected));
        }
      });

      if (focus) {
        nextTab.focus();
      }
    };

    const moveTabFocus = (currentIndex, direction) => {
      const lastIndex = tabs.length - 1;
      let nextIndex = currentIndex;

      if (direction === 'next') {
        nextIndex = currentIndex === lastIndex ? 0 : currentIndex + 1;
      } else if (direction === 'prev') {
        nextIndex = currentIndex === 0 ? lastIndex : currentIndex - 1;
      } else if (direction === 'first') {
        nextIndex = 0;
      } else if (direction === 'last') {
        nextIndex = lastIndex;
      }

      activateTab(tabs[nextIndex], { focus: true });
    };

    const initiallySelectedTab = tabs.find((tab) => tab.getAttribute('aria-selected') === 'true') || tabs[0];
    activateTab(initiallySelectedTab);

    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => activateTab(tab));
      tab.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
          event.preventDefault();
          moveTabFocus(index, 'next');
        }

        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
          event.preventDefault();
          moveTabFocus(index, 'prev');
        }

        if (event.key === 'Home') {
          event.preventDefault();
          moveTabFocus(index, 'first');
        }

        if (event.key === 'End') {
          event.preventDefault();
          moveTabFocus(index, 'last');
        }
      });
    });
  }

  /* ---- FAQ smooth open/close ---- */
  document.querySelectorAll('.faq__item').forEach(item => {
    item.addEventListener('toggle', () => {
      /* Close other open items */
      if (item.open) {
        document.querySelectorAll('.faq__item[open]').forEach(other => {
          if (other !== item) other.removeAttribute('open');
        });
      }
    });
  });

  /* ---- Shared quiz entry tracking ---- */
  const QUIZ_ENTRY_CONTEXT = {
    'home-courses-footer': {
      journey: 'homepage_comparison',
      cta_surface: 'comparison_footer',
    },
    'home-quiz-band': {
      journey: 'homepage_comparison',
      cta_surface: 'comparison_quiz_band',
    },
    'courses-spotlight': {
      journey: 'courses_overview',
      cta_surface: 'overview_spotlight',
    },
    'courses-grid-cta': {
      journey: 'courses_overview',
      cta_surface: 'overview_grid_tile',
    },
  };

  const syncQuizSourceParam = (link) => {
    const source = link.dataset.quizSource;
    const href = link.getAttribute('href');
    if (!source || !href) return;

    const url = new URL(href, window.location.origin);
    const isQuizPath = /^\/quiz(?:\.html)?$/.test(url.pathname);
    if (!isQuizPath || url.searchParams.get('source') === source) return;

    url.searchParams.set('source', source);
    link.setAttribute('href', `${url.pathname}${url.search}${url.hash}`);
  };

  const getQuizEntryParams = (link) => {
    const source = link.dataset.quizSource;
    const params = { source };
    const contextualParams = QUIZ_ENTRY_CONTEXT[source];

    if (contextualParams) {
      Object.assign(params, contextualParams);
    }

    if (params.journey === 'homepage_comparison') {
      const activeComparisonTab = document.querySelector('.selector__tab[aria-selected="true"]');
      const activeStudentType = activeComparisonTab?.dataset.tab;
      if (activeStudentType) {
        params.active_student_type = activeStudentType;
      }
    }

    return params;
  };

  document.querySelectorAll('[data-quiz-source]').forEach(syncQuizSourceParam);

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[data-quiz-source]');
    if (!link) return;

    track('quiz_entry_clicked', getQuizEntryParams(link));
  });

  /* ---- Persistent floating quiz CTA ---- */
  const pathname = window.location.pathname;
  const shouldHideFloatingQuizCta = [
    /^\/quiz(?:\.html)?$/,
    /^\/checkout(?:\/|$)/,
    /^\/webinar(?:\/|\.html$|$)/,
    /^\/section-1-tracker(?:\.html)?$/,
  ].some((pattern) => pattern.test(pathname));

  if (!shouldHideFloatingQuizCta) {
    const floatingCta = document.createElement('a');
    floatingCta.className = 'floating-quiz-cta';
    floatingCta.href = '/quiz?source=floating-cta';
    floatingCta.dataset.quizSource = 'floating-cta';
    floatingCta.setAttribute('aria-label', 'Take the study plan quiz');
    floatingCta.innerHTML = `
      <span class="floating-quiz-cta__eyebrow">Study Plan Quiz</span>
      <span class="floating-quiz-cta__body">
        <span class="floating-quiz-cta__title">Take 2 minute quiz to get your free study plan</span>
        <span class="floating-quiz-cta__arrow" aria-hidden="true">→</span>
      </span>
    `;
    document.body.appendChild(floatingCta);
    document.body.classList.add('has-floating-quiz-cta');
  }

  /* ---- Analytics: Buy Now click (begin_checkout) ---- */
  const GA4_PRODUCTS = {
    blueprint:         { name: "Rohan's Blueprint",                  price: 599 },
    advanced:          { name: 'GAMSAT Advanced Series',             price: 299 },
    'essay-collection':{ name: 'Expert Essay Collection',            price: 79 },
    'starter-pack':    { name: 'GAMSAT Essentials Playbook',         price: 97 },
    'essay-marking':   { name: 'S2 Essay Marking',                   price: 34.99 },
    'essay-pack-10':   { name: 'S2 Essay Marking — 10-Essay Pack',   price: 249 },
    comprehensive:     { name: 'Comprehensive Course',               price: 1549 },
    mastery:           { name: 'Mastery Program',                    price: 2249 },
    'private-mentoring':{ name: 'Private Mentoring',                 price: null },
  };

  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href]');
    if (!link) return;
    const href = link.getAttribute('href') || '';
    if (!href.includes('/checkout')) return;
    const params = new URLSearchParams(href.split('?')[1] || '');
    const slug = params.get('product');
    const product = GA4_PRODUCTS[slug];
    if (typeof window.gtag !== 'function') return;
    window.gtag('event', 'begin_checkout', {
      currency: 'AUD',
      value: product ? product.price : undefined,
      items: [{
        item_id: slug || 'unknown',
        item_name: product ? product.name : slug || 'unknown',
        price: product ? product.price : undefined,
        quantity: 1,
      }],
    });
  });

  /* ---- Analytics: ConvertKit newsletter signup ---- */
  document.addEventListener('submit', (e) => {
    const form = e.target.closest('.formkit-form');
    if (!form) return;
    track('newsletter_signup', { method: 'convertkit' });
  }, { capture: true });
});
