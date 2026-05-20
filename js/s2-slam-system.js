document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('slamLeadForm');
  const submitBtn = document.getElementById('slamLeadSubmit');
  const submitText = submitBtn?.querySelector('.slam-lead-form__submit-text');
  const submitLoading = submitBtn?.querySelector('.slam-lead-form__submit-loading');
  const success = document.getElementById('slamLeadSuccess');
  const error = document.getElementById('slamLeadError');

  if (!form || !submitBtn || !submitText || !submitLoading || !success || !error) return;

  const setLoadingState = (isLoading) => {
    submitBtn.disabled = isLoading;
    submitText.hidden = isLoading;
    submitLoading.hidden = !isLoading;
  };

  const fireLeadEvent = (status) => {
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'generate_lead', { form_id: 'slamLeadForm', resource: 'S2 Slam System' });
      if (status === 'fallback') {
        window.gtag('event', 'free_resource_fallback', { resource: 'S2 Slam System' });
      }
    }
    if (typeof window.posthog !== 'undefined' && status === 'fallback') {
      window.posthog.capture('free_resource_fallback', { resource: 'S2 Slam System' });
    }
  };

  const fireDeliveryEvent = () => {
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'free_resource_download', { resource: 'S2 Slam System' });
    }
    if (typeof window.posthog !== 'undefined') {
      window.posthog.capture('free_resource_download', { resource: 'S2 Slam System' });
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
          resourceKey: 's2-slam-system',
          firstName: firstNameInput ? firstNameInput.value : '',
          email: emailInput ? emailInput.value : '',
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload || payload.ok !== true) {
        throw new Error(payload && payload.error ? payload.error : 'Form submission failed');
      }

      fireLeadEvent(payload.status);

      if (payload.status === 'fallback' && payload.fallback && payload.fallback.url) {
        success.innerHTML = `<strong>S2 Slam System request received.</strong> ${payload.message} <a href="${payload.fallback.url}">${payload.fallback.label || 'Open the backup option'}</a>`;
      } else {
        form.reset();
        success.innerHTML = `<strong>You're in.</strong> Check your inbox for the S2 Slam System, then use the free quiz if you want a course recommendation. <a href="/quiz" class="btn btn--outline">Take the Free Quiz</a>`;
        fireDeliveryEvent();
      }

      success.hidden = false;
      success.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (submissionError) {
      if (submissionError && submissionError.message === 'Failed to fetch') {
        HTMLFormElement.prototype.submit.call(form);
        return;
      }
      error.hidden = false;
      error.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } finally {
      setLoadingState(false);
    }
  });
});
