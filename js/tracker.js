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

// ConvertKit form success → fire GA4 tracking event.
// ConvertKit sets data-state="success" on the form element after a valid subscribe.
(function () {
  function watchConvertKitForm(form, resourceName) {
    if (!form) return;
    const observer = new MutationObserver(function () {
      if (form.getAttribute('data-state') === 'success') {
        observer.disconnect();
        if (typeof window.gtag === 'function') {
          window.gtag('event', 'free_resource_download', { resource: resourceName });
          window.gtag('event', 'generate_lead', { form_id: form.id || resourceName, resource: resourceName });
        }
        if (typeof window.posthog !== 'undefined') {
          window.posthog.capture('free_resource_download', { resource: resourceName });
        }
      }
    });
    observer.observe(form, { attributes: true, attributeFilter: ['data-state'] });
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.seva-form').forEach(function (form) {
      watchConvertKitForm(form, 'S1 Question Tracker');
    });
  });
})();
