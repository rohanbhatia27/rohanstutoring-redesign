document.addEventListener('DOMContentLoaded', () => {
  const webinarForm = document.querySelector('.webinar-kit-form');

  if (!webinarForm) {
    return;
  }

  const submitButton = webinarForm.querySelector('[data-element="submit"]');

  if (!submitButton) {
    return;
  }

  webinarForm.addEventListener('submit', () => {
    submitButton.disabled = true;
    submitButton.setAttribute('data-active', 'true');
  });
});
