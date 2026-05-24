/* ============================================
   CONTACT FORM — contact.js
   Handles Formspree async submission
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('contactForm');
  const submitBtn = document.getElementById('submitBtn');
  const btnText = submitBtn?.querySelector('.form-submit__text');
  const btnLoading = submitBtn?.querySelector('.form-submit__loading');
  const success = document.getElementById('formSuccess');
  const error = document.getElementById('formError');
  const errorText = error?.querySelector('.form-error__text');
  const defaultErrorMessage = errorText?.textContent || 'Something went wrong. Please try again or email us directly.';

  if (!form || !submitBtn || !btnText || !btnLoading || !success || !error) return;

  const showError = (message) => {
    if (errorText) errorText.textContent = message;
    error.style.display = 'flex';
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (submitBtn.disabled) return;

    // Show loading state
    btnText.style.display = 'none';
    btnLoading.style.display = 'inline';
    submitBtn.disabled = true;
    success.style.display = 'none';
    error.style.display = 'none';
    if (errorText) errorText.textContent = defaultErrorMessage;

    const data = new FormData(form);

    try {
      const response = await fetch(form.action, {
        method: 'POST',
        body: data,
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        // Success
        form.reset();
        if (typeof window.gtag === 'function') {
          window.gtag('event', 'contact_form_submit');
          window.gtag('event', 'generate_lead', { form_id: 'contact' });
        }
        if (typeof window.posthog !== 'undefined') {
          window.posthog.capture('contact_form_submitted');
        }
        success.style.display = 'flex';
        success.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else if (response.status === 403 || response.status === 422 || response.status === 429) {
        showError('Security check failed. Please refresh and try again.');
      } else {
        throw new Error('Server error');
      }
    } catch (err) {
      showError(defaultErrorMessage);
    } finally {
      btnText.style.display = 'inline';
      btnLoading.style.display = 'none';
      submitBtn.disabled = false;
    }
  });
});
