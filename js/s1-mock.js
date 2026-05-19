(function () {
  var RESOURCE = 'S1 Mini Mock';
  var tracked = false;

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
    form.innerHTML = '<div class="formkit-alert">Check your inbox! Your S1 Mini Mock is on its way.</div>';
  }

  // defer scripts run after DOM parsing — attach directly, no DOMContentLoaded needed.
  document.addEventListener('submit', async function (e) {
    var form = e.target.closest('.seva-form');
    if (!form) return;
    e.preventDefault();
    var btn = form.querySelector('[type="submit"]');
    var origText = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = '<span>Sending…</span>'; }

    try {
      var body = new URLSearchParams(new FormData(form)).toString();
      var res = await fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body,
      });
      if (!res.ok) throw new Error(res.status);
      showSuccess(form);
      fireEvents();
    } catch (_) {
      if (btn) { btn.disabled = false; btn.innerHTML = origText; }
    }
  }, { capture: true });
})();
