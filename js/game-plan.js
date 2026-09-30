document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('planLeadForm');
  const submitBtn = document.getElementById('planLeadSubmit');
  const submitText = submitBtn?.querySelector('.plan-lead-form__submit-text');
  const submitLoading = submitBtn?.querySelector('.plan-lead-form__submit-loading');
  const success = document.getElementById('planLeadSuccess');
  const error = document.getElementById('planLeadError');

  if (!form || !submitBtn || !submitText || !submitLoading || !success || !error) return;

  const RESOURCE_KEY = 'game-plan';
  const RESOURCE_NAME = 'March 2027 Game Plan';
  const successUrl = form.getAttribute('data-success-url') || '/game-plan-thank-you';

  const escapeHtml = (value) => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const getSafeHref = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (raw.startsWith('/') && !raw.startsWith('//')) {
      return escapeHtml(raw);
    }

    try {
      const parsed = new URL(raw, window.location.origin);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'mailto:') {
        return escapeHtml(parsed.href);
      }
    } catch (_) {
      return '';
    }

    return '';
  };

  const setLoadingState = (isLoading) => {
    submitBtn.disabled = isLoading;
    submitText.hidden = isLoading;
    submitLoading.hidden = !isLoading;
  };

  const fireLeadEvents = (status) => {
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'generate_lead', { form_id: 'planLeadForm', resource: RESOURCE_NAME, resource_key: RESOURCE_KEY });
      window.gtag('event', 'lead_form_submit', { resource_key: RESOURCE_KEY, status: status || '' });
      if (status === 'fallback') {
        window.gtag('event', 'free_resource_fallback', { resource: RESOURCE_NAME });
      } else {
        window.gtag('event', 'free_resource_download', { resource: RESOURCE_NAME });
      }
    }
    if (typeof window.posthog !== 'undefined') {
      window.posthog.capture(status === 'fallback' ? 'free_resource_fallback' : 'free_resource_download', { resource: RESOURCE_NAME });
    }
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitBtn.disabled) return;

    success.hidden = true;
    error.hidden = true;
    setLoadingState(true);

    try {
      const firstNameInput = form.querySelector('input[name="fields[first_name]"]');
      const emailInput = form.querySelector('input[name="email_address"]');
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resourceKey: RESOURCE_KEY,
          firstName: firstNameInput ? firstNameInput.value : '',
          email: emailInput ? emailInput.value : '',
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload || payload.ok !== true) {
        throw new Error(payload && payload.error ? payload.error : 'Form submission failed');
      }

      fireLeadEvents(payload.status);

      if (payload.status === 'fallback') {
        const fallback = payload.fallback || {};
        const fallbackHref = getSafeHref(fallback.url);
        const fallbackLabel = escapeHtml(fallback.label || 'Open the backup option');
        const fallbackLinkHtml = fallbackHref ? ` <a href="${fallbackHref}">${fallbackLabel}</a>` : '';
        success.innerHTML = `<strong>Game Plan request received.</strong> ${escapeHtml(payload.message || '')}${fallbackLinkHtml}`;
        success.hidden = false;
        success.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        setLoadingState(false);
        return;
      }

      // Give analytics a moment to flush before leaving the page.
      window.setTimeout(() => {
        window.location.assign(successUrl);
      }, 300);
    } catch (_) {
      error.hidden = false;
      error.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      setLoadingState(false);
    }
  });
});
