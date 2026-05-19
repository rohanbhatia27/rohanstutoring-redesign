document.addEventListener('DOMContentLoaded', () => {
  document.querySelector('.floating-quiz-cta')?.remove();
  document.body.classList.remove('has-floating-quiz-cta');

  const modal = document.querySelector('[data-tracker-preview-modal]');
  const openButton = document.querySelector('[data-tracker-preview-open]');
  const closeButton = document.querySelector('[data-tracker-preview-close]');

  if (!modal || !openButton || !closeButton || typeof modal.showModal !== 'function') {
    return;
  }

  const closePreview = () => {
    modal.close();
    document.body.classList.remove('tracker-preview-open');
  };

  openButton.addEventListener('click', () => {
    modal.showModal();
    document.body.classList.add('tracker-preview-open');
    modal.querySelector('.tracker-preview-modal__scroller')?.focus();
  });

  closeButton.addEventListener('click', closePreview);

  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      closePreview();
    }
  });

  modal.addEventListener('close', () => {
    document.body.classList.remove('tracker-preview-open');
    window.setTimeout(() => openButton.focus({ preventScroll: true }), 0);
  });
});

// Kit form submission — handled via fetch so there's no reCAPTCHA dependency.
(function () {
  const RESOURCE = 'S1 Question Tracker';
  let tracked = false;

  function fireEvents() {
    if (tracked) return;
    tracked = true;
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'free_resource_download', { resource: RESOURCE });
      window.gtag('event', 'generate_lead', { form_id: RESOURCE, resource: RESOURCE });
    }
    if (typeof window.posthog !== 'undefined') {
      window.posthog.capture('free_resource_download', { resource: RESOURCE });
    }
  }

  function showSuccess(form) {
    form.setAttribute('data-state', 'success');
    const isCard = form.classList.contains('tracker-form');
    form.innerHTML = isCard
      ? '<p class="tracker-form__success">Check your inbox — the tracker is on its way.</p>'
      : '<div class="formkit-alert">Check your inbox! The S1 Tracker is on its way.</div>';
  }

  // defer scripts run after parsing — DOM is ready, no DOMContentLoaded needed.
  document.querySelectorAll('.seva-form').forEach(function (form) {
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      const btn = form.querySelector('[type="submit"]');
      const origText = btn ? btn.innerHTML : '';
      if (btn) { btn.disabled = true; btn.innerHTML = '<span>Sending…</span>'; }

      try {
        const body = new URLSearchParams(new FormData(form)).toString();
        const res = await fetch(form.action, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
        });
        if (!res.ok) throw new Error(res.status);
        showSuccess(form);
        fireEvents();
      } catch (_) {
        if (btn) { btn.disabled = false; btn.innerHTML = origText; }
      }
    });
  });
})();
