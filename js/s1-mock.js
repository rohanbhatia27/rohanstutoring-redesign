(function () {
  var RESOURCE = 'S1 Mini Mock';
  var leadTracked = false;
  var deliveryTracked = false;

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
    successInlineMessage: 'Check your inbox! Your S1 Mini Mock is on its way.',
    successCardMessage: 'Check your inbox! Your S1 Mini Mock is on its way.',
    onLeadCaptured: function (status) {
      fireLeadEvent(status);
      if (status === 'kit') {
        fireDeliveryEvent();
      }
    }
  });
})();
