/* ============================================
   CONTACT FORM — contact.js
   Handles Formspree async submission
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  const form       = document.getElementById('contactForm');
  const submitBtn  = document.getElementById('submitBtn');
  const btnText    = submitBtn?.querySelector('.form-submit__text');
  const btnLoading = submitBtn?.querySelector('.form-submit__loading');
  const success    = document.getElementById('formSuccess');
  const error      = document.getElementById('formError');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Show loading state
    btnText.style.display    = 'none';
    btnLoading.style.display = 'inline';
    submitBtn.disabled       = true;
    success.style.display    = 'none';
    error.style.display      = 'none';

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
        success.style.display = 'flex';
        success.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        throw new Error('Server error');
      }
    } catch (err) {
      error.style.display = 'flex';
    } finally {
      btnText.style.display    = 'inline';
      btnLoading.style.display = 'none';
      submitBtn.disabled       = false;
    }
  });
});
