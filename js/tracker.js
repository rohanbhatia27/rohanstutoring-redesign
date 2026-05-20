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

(function () {
  const RESOURCE = 'S1 Question Tracker';
  let leadTracked = false;
  let deliveryTracked = false;

  function fireLeadEvent(status) {
    if (leadTracked) return;
    leadTracked = true;
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'generate_lead', { form_id: RESOURCE, resource: RESOURCE });
      if (status === 'fallback') {
        window.gtag('event', 'free_resource_fallback', { resource: RESOURCE });
      }
    }
    if (typeof window.posthog !== 'undefined' && status === 'fallback') {
      window.posthog.capture('free_resource_fallback', { resource: RESOURCE });
    }
  }

  function fireDeliveryEvent() {
    if (deliveryTracked) return;
    deliveryTracked = true;
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'free_resource_download', { resource: RESOURCE });
    }
    if (typeof window.posthog !== 'undefined') {
      window.posthog.capture('free_resource_download', { resource: RESOURCE });
    }
  }

  if (typeof window.initFreeResourceForms !== 'function') {
    return;
  }

  window.initFreeResourceForms({
    resourceName: RESOURCE,
    successInlineMessage: 'Check your inbox! The S1 Tracker is on its way.',
    successCardMessage: 'Check your inbox — the tracker is on its way.',
    onLeadCaptured: function (status) {
      fireLeadEvent(status);
      if (status === 'kit') {
        fireDeliveryEvent();
      }
    },
  });
})();
