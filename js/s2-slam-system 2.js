document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('slamLeadForm');
  const submitBtn = document.getElementById('slamLeadSubmit');
  const submitText = submitBtn?.querySelector('.slam-lead-form__submit-text');
  const submitLoading = submitBtn?.querySelector('.slam-lead-form__submit-loading');
  const success = document.getElementById('slamLeadSuccess');
  const error = document.getElementById('slamLeadError');

  if (!form || !submitBtn || !submitText || !submitLoading || !success || !error) return;

  const REDIRECT_DELAY_MS = 2200;

  const setLoadingState = (isLoading) => {
    submitBtn.disabled = isLoading;
    submitText.hidden = isLoading;
    submitLoading.hidden = !isLoading;
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitBtn.disabled) return;

    success.hidden = true;
    error.hidden = true;
    setLoadingState(true);

    try {
      const response = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' }
      });

      if (!response.ok) {
        throw new Error('Form submission failed');
      }

      form.reset();
      success.hidden = false;
      success.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

      window.setTimeout(() => {
        window.location.assign('/webinar');
      }, REDIRECT_DELAY_MS);
    } catch (submissionError) {
      error.hidden = false;
      error.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } finally {
      setLoadingState(false);
    }
  });
});
