/* ============================================
   ROHAN'S GAMSAT — main.js
   Lightweight interactions + utility JS
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- Nav: transparent → solid on scroll ---- */
  const nav = document.getElementById('nav');
  const onScroll = () => {
    nav.classList.toggle('scrolled', window.scrollY > 40);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---- Mobile burger ---- */
  const burger = document.getElementById('burger');
  const mobileMenu = document.getElementById('mobileMenu');
  if (burger && mobileMenu) {
    const setMobileMenuState = (isOpen) => {
      burger.setAttribute('aria-expanded', String(isOpen));
      burger.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
      burger.setAttribute('aria-controls', mobileMenu.id);
      document.body.classList.toggle('menu-open', isOpen);
      mobileMenu.classList.toggle('open', isOpen);
      mobileMenu.hidden = !isOpen;
      mobileMenu.setAttribute('aria-hidden', String(!isOpen));
    };

    setMobileMenuState(mobileMenu.classList.contains('open'));

    burger.addEventListener('click', () => {
      setMobileMenuState(!mobileMenu.classList.contains('open'));
    });

    mobileMenu.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => setMobileMenuState(false));
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && mobileMenu.classList.contains('open')) {
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
});
